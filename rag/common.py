"""
Shared pieces of the "Ask FoodSphere" RAG pipeline:
markdown chunking, contextual headers, tokenizer, LSA embeddings, an Ollama client and the SQLite connection
(sqlite-vec for vectors + FTS5 for keywords).

Works without Ollama (LSA embeddings, rule-based contexts, extractive answers) and gets better with it
(nomic-embed-text embeddings, LLM-written chunk contexts, LLM answers from DeepSeek / Llama / Qwen / Mistral).
"""
from __future__ import annotations

import json
import math
import os
import re
import sqlite3
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
KNOWLEDGE = ROOT / 'rag/knowledge'
DB_PATH = ROOT / 'data/rag.db'
CONTEXT_CACHE = ROOT / 'rag/context_cache.json'
LIVE_INDEX = ROOT / 'lib/rag/index.json'
REPORTS = ROOT / 'rag/reports'

OLLAMA_URL = os.environ.get('OLLAMA_URL', 'http://localhost:11434').rstrip('/')
EMBED_MODEL = os.environ.get('RAG_EMBED_MODEL', 'nomic-embed-text')
CONTEXT_MODEL = os.environ.get('RAG_CONTEXT_MODEL', 'qwen2.5:1.5b')
LOCAL_MODELS = ['qwen2.5:1.5b', 'llama3.2:1b', 'deepseek-r1:1.5b', 'mistral:7b']
LSA_DIMS = 64
CHUNK_CHARS = 700

STOPWORDS = set("""a an and are as at be been but by can do does for from has have how i if in into is it its
of on or our so than that the their them then there these they this to was we were what when where which who
why will with you your yours about after before also any each more most not only other over same such too very""".split())


# ---------- text ----------

def tokenize(text: str) -> List[str]:
    """Lowercase word tokens without stopwords; plural 's' folded. Mirrored in lib/rag/search.ts."""
    out = []
    for t in re.findall(r'[a-z0-9]+', text.lower()):
        if t in STOPWORDS or len(t) < 2:
            continue
        if len(t) > 4 and t.endswith('s') and not t.endswith('ss'):
            t = t[:-1]
        out.append(t)
    return out


@dataclass
class Chunk:
    id: int
    doc: str            # file stem, e.g. page_guidelines
    doc_title: str
    section: str        # heading path, e.g. "Storage and handling"
    text: str           # the chunk itself
    context: str = ''   # 1-2 sentences situating the chunk in its document (Contextual RAG)
    context_source: str = 'rules'  # 'rules' or the Ollama model that wrote it

    @property
    def contextual_text(self) -> str:
        return f'{self.context}\n\n{self.text}' if self.context else self.text

    def to_dict(self) -> dict:
        return asdict(self)


def split_markdown(doc: str, md: str) -> tuple[str, List[tuple[str, str]]]:
    """Return (document title, [(section heading path, section text)])."""
    lines = md.splitlines()
    title = next((l[2:].strip() for l in lines if l.startswith('# ')), doc)
    sections: List[tuple[str, str]] = []
    h2, h3, buf = '', '', []

    def flush():
        text = '\n'.join(buf).strip()
        if text:
            path = ' > '.join(p for p in (h2, h3) if p) or 'Introduction'
            sections.append((path, text))
        buf.clear()

    for line in lines:
        if line.startswith('# '):
            continue
        if line.startswith('## '):
            flush(); h2, h3 = line[3:].strip(), ''
        elif line.startswith('### '):
            flush(); h3 = line[4:].strip()
        else:
            buf.append(line)
    flush()
    return title, sections


def window(text: str, size: int = CHUNK_CHARS) -> List[str]:
    """Split long sections on paragraph, then sentence boundaries; one sentence of overlap between windows."""
    if len(text) <= size:
        return [text]
    units: List[str] = []
    for para in re.split(r'\n\s*\n', text):
        units += [para] if len(para) <= size else re.split(r'(?<=[.!?])\s+', para)
    out, cur = [], ''
    for u in units:
        if cur and len(cur) + len(u) + 1 > size:
            out.append(cur.strip())
            last = re.split(r'(?<=[.!?])\s+', cur.strip())[-1]
            cur = (last + ' ' if len(last) < size // 3 else '') + u
        else:
            cur = f'{cur}\n{u}' if cur else u
    if cur.strip():
        out.append(cur.strip())
    return out


def load_chunks() -> tuple[List[Chunk], Dict[str, str]]:
    chunks: List[Chunk] = []
    docs: Dict[str, str] = {}
    for f in sorted(KNOWLEDGE.glob('*.md')):
        md = f.read_text()
        docs[f.stem] = md
        title, sections = split_markdown(f.stem, md)
        for section, text in sections:
            for piece in window(text):
                chunks.append(Chunk(len(chunks) + 1, f.stem, title, section, piece))
    return chunks, docs


def rule_context(c: Chunk, docs: Dict[str, str]) -> str:
    """Fallback context when no LLM is available: document title, section and the document's opening line."""
    intro = next((l.strip() for l in docs[c.doc].splitlines()[1:] if l.strip() and not l.startswith('#')), '')
    intro = re.split(r'(?<=[.!?])\s', intro)[0]
    return f'From the FoodSphere AI document "{c.doc_title}", section "{c.section}". {intro}'.strip()


CONTEXT_PROMPT = """<document>
{doc}
</document>
Here is the chunk we want to situate within the whole document
<chunk>
{chunk}
</chunk>
Please give a short succinct context to situate this chunk within the overall document for the purposes of improving search retrieval of the chunk. Answer only with the succinct context and nothing else."""


# ---------- Ollama ----------

class Ollama:
    def __init__(self, url: str = OLLAMA_URL, timeout: float = 300):
        self.url, self.timeout = url, timeout

    def _post(self, path: str, body: dict) -> dict:
        req = urllib.request.Request(self.url + path, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=self.timeout) as r:
            return json.loads(r.read())

    def models(self) -> List[str]:
        try:
            with urllib.request.urlopen(self.url + '/api/tags', timeout=3) as r:
                return [m['name'] for m in json.loads(r.read()).get('models', [])]
        except (urllib.error.URLError, OSError, ValueError):
            return []

    def has(self, model: str) -> bool:
        names = self.models()
        return model in names or f'{model}:latest' in names

    def embed(self, texts: List[str], model: str = EMBED_MODEL) -> np.ndarray:
        vecs = []
        for i in range(0, len(texts), 16):
            vecs += self._post('/api/embed', {'model': model, 'input': texts[i:i + 16]})['embeddings']
        return normalize(np.array(vecs, dtype=np.float32))

    def chat(self, model: str, messages: List[dict], temperature: float = 0.0, num_predict: int = 400) -> dict:
        t0 = time.time()
        r = self._post('/api/chat', {'model': model, 'messages': messages, 'stream': False,
                                     'options': {'temperature': temperature, 'num_predict': num_predict, 'seed': 7}})
        text = r['message']['content']
        thinking = ''
        m = re.search(r'<think>(.*?)</think>', text, re.S)   # DeepSeek-R1 reasons inside <think> tags
        if m:
            thinking, text = m.group(1).strip(), (text[:m.start()] + text[m.end():]).strip()
        return {'text': text.strip(), 'thinking': thinking, 'seconds': round(time.time() - t0, 2),
                'eval_tokens': r.get('eval_count'), 'tokens_per_second':
                    round(r['eval_count'] / (r['eval_duration'] / 1e9), 1) if r.get('eval_count') and r.get('eval_duration') else None}


# ---------- embeddings ----------

def normalize(m: np.ndarray) -> np.ndarray:
    n = np.linalg.norm(m, axis=-1, keepdims=True)
    return m / np.where(n == 0, 1, n)


@dataclass
class LSA:
    """TF-IDF + truncated SVD (latent semantic analysis): small dense embeddings that also run in the browser/server
    without any model download. Same maths as scikit-learn's TfidfVectorizer(smooth_idf, sublinear_tf) + SVD."""
    vocab: Dict[str, int] = field(default_factory=dict)
    idf: List[float] = field(default_factory=list)
    components: Optional[np.ndarray] = None  # dims x vocab

    def fit(self, texts: List[str], dims: int = LSA_DIMS) -> 'LSA':
        toks = [tokenize(t) for t in texts]
        self.vocab = {w: i for i, w in enumerate(sorted({w for ts in toks for w in ts}))}
        df = np.zeros(len(self.vocab))
        for ts in toks:
            for w in set(ts):
                df[self.vocab[w]] += 1
        n = len(texts)
        self.idf = list(np.log((1 + n) / (1 + df)) + 1)
        X = np.stack([self._tfidf(ts) for ts in toks])
        _, _, vt = np.linalg.svd(X, full_matrices=False)
        self.components = vt[:min(dims, len(vt))]
        return self

    def _tfidf(self, toks: List[str]) -> np.ndarray:
        v = np.zeros(len(self.vocab))
        for w in toks:
            i = self.vocab.get(w)
            if i is not None:
                v[i] += 1
        nz = v > 0
        v[nz] = (1 + np.log(v[nz])) * np.array(self.idf)[nz]
        n = np.linalg.norm(v)
        return v / n if n else v

    def embed(self, texts: List[str]) -> np.ndarray:
        X = np.stack([self._tfidf(tokenize(t)) for t in texts])
        return normalize((X @ self.components.T).astype(np.float32))


# ---------- SQLite: sqlite-vec + FTS5 ----------

def connect(path: Path = DB_PATH):
    """Open SQLite with the sqlite-vec extension. Returns (connection, vector_backend)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(str(path))
    try:
        import sqlite_vec
        con.enable_load_extension(True)
        sqlite_vec.load(con)
        con.enable_load_extension(False)
        return con, 'sqlite-vec ' + con.execute('select vec_version()').fetchone()[0]
    except (ImportError, AttributeError, sqlite3.OperationalError) as e:
        # Some Python builds (e.g. Apple's system Python) cannot load SQLite extensions.
        print(f'[rag] sqlite-vec unavailable ({type(e).__name__}): using numpy vector search. '
              'Install Python from python.org or Homebrew to use sqlite-vec.')
        return con, 'numpy'


def f32(v: np.ndarray) -> bytes:
    return np.asarray(v, dtype=np.float32).tobytes()


def fts_query(text: str) -> str:
    toks = list(dict.fromkeys(tokenize(text)))
    return ' OR '.join(f'"{t}"' for t in toks) or '""'


def rrf(rankings: List[List[int]], k: int = 60) -> Dict[int, float]:
    """Reciprocal Rank Fusion: score = sum over result lists of 1 / (k + rank)."""
    scores: Dict[int, float] = {}
    for ranking in rankings:
        for rank, cid in enumerate(ranking, 1):
            scores[cid] = scores.get(cid, 0.0) + 1.0 / (k + rank)
    return scores


def cosine_top(matrix: np.ndarray, q: np.ndarray, k: int) -> List[tuple[int, float]]:
    sims = matrix @ q
    order = np.argsort(-sims)[:k]
    return [(int(i), float(sims[i])) for i in order]


def bm25_scores(docs_tokens: List[List[str]], query: List[str], k1: float = 1.2, b: float = 0.75) -> np.ndarray:
    n = len(docs_tokens)
    avg = sum(len(d) for d in docs_tokens) / max(n, 1)
    df: Dict[str, int] = {}
    for d in docs_tokens:
        for w in set(d):
            df[w] = df.get(w, 0) + 1
    out = np.zeros(n)
    for i, d in enumerate(docs_tokens):
        tf: Dict[str, int] = {}
        for w in d:
            tf[w] = tf.get(w, 0) + 1
        for w in set(query):
            if w in tf:
                idf = math.log(1 + (n - df[w] + 0.5) / (df[w] + 0.5))
                out[i] += idf * tf[w] * (k1 + 1) / (tf[w] + k1 * (1 - b + b * len(d) / avg))
    return out
