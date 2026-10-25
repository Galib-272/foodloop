"""
Retrieval over data/rag.db.

  mode = 'vector'  sqlite-vec nearest neighbours (cosine)              -> Naive RAG
  mode = 'keyword' SQLite FTS5 full-text search ranked by BM25
  mode = 'hybrid'  both, fused with Reciprocal Rank Fusion              -> Hybrid search
  contextual=True  searches the chunks with their LLM-written context  -> Contextual RAG
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Dict, List

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import DB_PATH, LIVE_INDEX, LSA, Ollama, connect, cosine_top, f32, fts_query, rrf  # noqa: E402


class Retriever:
    def __init__(self, db_path: Path = DB_PATH):
        if not db_path.exists():
            raise SystemExit('[rag] data/rag.db not found. Run: npm run rag:ingest')
        self.con, self.backend = connect(db_path)
        self.meta = dict(self.con.execute('SELECT key, value FROM meta'))
        self.chunks = {r[0]: {'id': r[0], 'doc': r[1], 'doc_title': r[2], 'section': r[3], 'text': r[4], 'context': r[5],
                              'context_source': r[6]} for r in self.con.execute('SELECT * FROM chunks')}
        self.embedding = self.meta['embedding']
        if self.embedding == 'lsa':
            idx = json.loads(LIVE_INDEX.read_text())
            self.lsa = LSA(vocab={w: i for i, w in enumerate(idx['vocab'])}, idf=idx['idf'],
                           components=np.array(idx['components'], dtype=np.float64))
        else:
            self.ollama = Ollama()
            self.embed_model = self.embedding.split(':', 1)[1]
        if self.backend == 'numpy':
            self.matrix = {}
            for kind in ('naive', 'ctx'):
                rows = self.con.execute('SELECT chunk_id, vec FROM embeddings WHERE kind=? ORDER BY chunk_id', (kind,)).fetchall()
                self.ids = [r[0] for r in rows]
                self.matrix[kind] = np.stack([np.frombuffer(r[1], dtype=np.float32) for r in rows])

    def embed_query(self, q: str) -> np.ndarray:
        if self.embedding == 'lsa':
            return self.lsa.embed([q])[0]
        return self.ollama.embed(['search_query: ' + q], model=self.embed_model)[0]

    def vector(self, q: str, contextual: bool, k: int) -> List[tuple]:
        kind = 'ctx' if contextual else 'naive'
        v = self.embed_query(q)
        if not np.any(v):  # no known words (LSA): nothing to compare
            return []
        if self.backend == 'numpy':
            return [(self.ids[i], s) for i, s in cosine_top(self.matrix[kind], v, k)]
        rows = self.con.execute(f'SELECT rowid, distance FROM vec_{kind} WHERE embedding MATCH ? AND k = ? ORDER BY distance',
                                (f32(v), k)).fetchall()
        return [(r[0], 1 - r[1]) for r in rows]  # cosine distance -> similarity

    def keyword(self, q: str, contextual: bool, k: int) -> List[tuple]:
        table = 'fts_ctx' if contextual else 'fts_naive'
        rows = self.con.execute(f'SELECT rowid, bm25({table}) AS s FROM {table} WHERE {table} MATCH ? ORDER BY s LIMIT ?',
                                (fts_query(q), k)).fetchall()
        return [(r[0], -r[1]) for r in rows]  # FTS5 bm25 is lower-is-better

    def search(self, q: str, mode: str = 'hybrid', contextual: bool = True, k: int = 5, pool: int = 20) -> List[Dict]:
        vec = self.vector(q, contextual, pool) if mode in ('vector', 'hybrid') else []
        kw = self.keyword(q, contextual, pool) if mode in ('keyword', 'hybrid') else []
        vrank = {cid: i + 1 for i, (cid, _) in enumerate(vec)}
        krank = {cid: i + 1 for i, (cid, _) in enumerate(kw)}
        vsim = dict(vec)
        if mode == 'hybrid':
            scores = rrf([[c for c, _ in vec], [c for c, _ in kw]])
        else:
            scores = dict(vec or kw)
        top = sorted(scores, key=lambda c: -scores[c])[:k]
        return [{**self.chunks[c], 'score': round(scores[c], 5), 'vector_rank': vrank.get(c), 'keyword_rank': krank.get(c),
                 'similarity': round(float(vsim[c]), 4) if c in vsim else None} for c in top]


if __name__ == '__main__':
    r = Retriever()
    q = ' '.join(sys.argv[1:]) or 'How cold should refrigerated food be kept?'
    print(f'Q: {q}  ({r.embedding}, {r.backend})')
    for hit in r.search(q):
        print(f"  {hit['score']:.4f}  v#{hit['vector_rank']} k#{hit['keyword_rank']}  {hit['doc']} > {hit['section']}")
