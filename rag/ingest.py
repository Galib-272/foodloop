"""
Ingest the knowledge base into the RAG store.

  1. Chunk every rag/knowledge/*.md document by heading, then into ~700-character windows.
  2. Contextual RAG: write 1-2 sentences that situate each chunk in its document
     (by an Ollama model, Anthropic's contextual-retrieval prompt; cached in rag/context_cache.json).
     Without Ollama, a rule-based context (document title + section + intro) is used.
  3. Embed both the plain chunks (naive RAG) and the contextualised chunks.
     Ollama nomic-embed-text when available, otherwise LSA embeddings.
  4. Store everything in data/rag.db: sqlite-vec tables for vectors, FTS5 tables for keyword search.
  5. Export lib/rag/index.json for the live website (LSA embeddings, so no model is needed on the server).

Run: python3 rag/ingest.py [--contexts auto|llm|rules] [--embed auto|ollama|lsa]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from datetime import datetime, timezone

import numpy as np

sys.path.insert(0, str(__import__('pathlib').Path(__file__).resolve().parent))
from common import (CONTEXT_CACHE, CONTEXT_MODEL, CONTEXT_PROMPT, DB_PATH, EMBED_MODEL, LIVE_INDEX, LSA,  # noqa: E402
                    STOPWORDS, Ollama, bm25_scores, connect, f32, load_chunks, rrf, rule_context, tokenize)


def chunk_key(doc_md: str, text: str) -> str:
    return hashlib.sha1((doc_md + '\x00' + text).encode()).hexdigest()[:16]


def add_contexts(chunks, docs, mode: str, ollama: Ollama) -> dict:
    cache = json.loads(CONTEXT_CACHE.read_text()) if CONTEXT_CACHE.exists() else {}
    use_llm = mode == 'llm' or (mode == 'auto' and ollama.has(CONTEXT_MODEL))
    if mode == 'llm' and not ollama.has(CONTEXT_MODEL):
        raise SystemExit(f'[ingest] Ollama model {CONTEXT_MODEL} not found. Run: ollama pull {CONTEXT_MODEL}')
    stats = {'llm_new': 0, 'llm_cached': 0, 'rules': 0}
    t0 = time.time()
    for c in chunks:
        key = chunk_key(docs[c.doc], c.text)
        hit = cache.get(key)
        if hit and mode != 'rules':
            c.context, c.context_source = hit['context'], hit['source']
            stats['llm_cached'] += 1
        elif use_llm:
            r = ollama.chat(CONTEXT_MODEL, [{'role': 'user', 'content': CONTEXT_PROMPT.format(doc=docs[c.doc], chunk=c.text)}], num_predict=120)
            c.context, c.context_source = ' '.join(r['text'].split())[:400], CONTEXT_MODEL
            cache[key] = {'context': c.context, 'source': CONTEXT_MODEL, 'doc': c.doc, 'section': c.section}
            stats['llm_new'] += 1
            print(f'  context {stats["llm_new"]}: {c.doc} / {c.section} ({r["seconds"]}s)', flush=True)
        else:
            c.context, c.context_source = rule_context(c, docs), 'rules'
            stats['rules'] += 1
    if stats['llm_new']:
        live = {chunk_key(docs[c.doc], c.text) for c in chunks}
        cache = {k: v for k, v in cache.items() if k in live}  # drop contexts of chunks that no longer exist
        CONTEXT_CACHE.write_text(json.dumps(cache, indent=1, ensure_ascii=False) + '\n')
    stats['seconds'] = round(time.time() - t0, 1)
    return stats


def live_search(idx: dict, q: str, k: int = 4, pool: int = 20) -> list:
    """The live website's search (lib/rag/search.ts), computed from the same rounded index.json, for the parity test."""
    lsa = LSA(vocab={w: i for i, w in enumerate(idx['vocab'])}, idf=idx['idf'], components=np.array(idx['components']))
    qv = lsa.embed([q])[0].astype(np.float64)
    vecs = np.array([c['vec'] for c in idx['chunks']])
    by_vec = [int(i) for i in np.argsort(-(vecs @ qv), kind='stable')[:pool]] if np.any(qv) else []
    toks = [tokenize(f"{c['context']}\n\n{c['text']}" if c['context'] else c['text']) for c in idx['chunks']]
    kw = bm25_scores(toks, tokenize(q))
    by_kw = [int(i) for i in np.argsort(-kw, kind='stable') if kw[i] > 0][:pool]
    scores = rrf([by_vec, by_kw])
    return [idx['chunks'][i]['id'] for i in sorted(scores, key=lambda i: (-scores[i], i))[:k]]


def write_golden() -> None:
    idx = json.loads(LIVE_INDEX.read_text())
    qs = [q['q'] for q in json.loads((LIVE_INDEX.parents[2] / 'rag/eval_questions.json').read_text())]
    qs += ['donor', 'how do volunteers deliver food', 'xyz qwerty']
    golden = [{'q': q, 'top': live_search(idx, q), 'vec': [round(float(x), 6) for x in
               LSA(vocab={w: i for i, w in enumerate(idx['vocab'])}, idf=idx['idf'], components=np.array(idx['components'])).embed([q])[0]]}
              for q in qs]
    (LIVE_INDEX.parent / 'golden.json').write_text(json.dumps({'builtAt': idx['builtAt'], 'cases': golden}, separators=(',', ':')))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--contexts', choices=['auto', 'llm', 'rules'], default='auto')
    ap.add_argument('--embed', choices=['auto', 'ollama', 'lsa'], default='auto')
    a = ap.parse_args()
    ollama = Ollama()

    chunks, docs = load_chunks()
    print(f'[ingest] {len(docs)} documents -> {len(chunks)} chunks')
    ctx_stats = add_contexts(chunks, docs, a.contexts, ollama)
    print(f'[ingest] contexts: {ctx_stats}')

    naive_texts = [f'{c.doc_title}. {c.section}. {c.text}' for c in chunks]  # naive RAG: chunk + its heading only
    ctx_texts = [c.contextual_text for c in chunks]
    lsa = LSA().fit(ctx_texts + naive_texts)

    use_ollama = a.embed == 'ollama' or (a.embed == 'auto' and ollama.has(EMBED_MODEL))
    if a.embed == 'ollama' and not use_ollama:
        raise SystemExit(f'[ingest] Ollama model {EMBED_MODEL} not found. Run: ollama pull {EMBED_MODEL}')
    if use_ollama:
        embedding = f'ollama:{EMBED_MODEL}'
        vec_naive = ollama.embed(['search_document: ' + t for t in naive_texts])
        vec_ctx = ollama.embed(['search_document: ' + t for t in ctx_texts])
    else:
        embedding = 'lsa'
        vec_naive, vec_ctx = lsa.embed(naive_texts), lsa.embed(ctx_texts)
    dims = vec_ctx.shape[1]

    DB_PATH.unlink(missing_ok=True)
    con, backend = connect()
    con.executescript("""
        CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE chunks (id INTEGER PRIMARY KEY, doc TEXT NOT NULL, doc_title TEXT NOT NULL, section TEXT NOT NULL,
                             text TEXT NOT NULL, context TEXT NOT NULL, context_source TEXT NOT NULL);
        CREATE TABLE embeddings (kind TEXT NOT NULL, chunk_id INTEGER NOT NULL REFERENCES chunks(id), vec BLOB NOT NULL,
                                 PRIMARY KEY (kind, chunk_id));
        CREATE VIRTUAL TABLE fts_naive USING fts5(text, tokenize = 'porter unicode61');
        CREATE VIRTUAL TABLE fts_ctx   USING fts5(text, tokenize = 'porter unicode61');
    """)
    if backend != 'numpy':
        con.execute(f'CREATE VIRTUAL TABLE vec_naive USING vec0(embedding float[{dims}] distance_metric=cosine)')
        con.execute(f'CREATE VIRTUAL TABLE vec_ctx USING vec0(embedding float[{dims}] distance_metric=cosine)')
    for c, nt, ct, vn, vc in zip(chunks, naive_texts, ctx_texts, vec_naive, vec_ctx):
        con.execute('INSERT INTO chunks VALUES (?,?,?,?,?,?,?)', (c.id, c.doc, c.doc_title, c.section, c.text, c.context, c.context_source))
        con.execute('INSERT INTO fts_naive (rowid, text) VALUES (?,?)', (c.id, nt))
        con.execute('INSERT INTO fts_ctx (rowid, text) VALUES (?,?)', (c.id, ct))
        con.execute('INSERT INTO embeddings VALUES (?,?,?)', ('naive', c.id, f32(vn)))
        con.execute('INSERT INTO embeddings VALUES (?,?,?)', ('ctx', c.id, f32(vc)))
        if backend != 'numpy':
            con.execute('INSERT INTO vec_naive (rowid, embedding) VALUES (?,?)', (c.id, f32(vn)))
            con.execute('INSERT INTO vec_ctx (rowid, embedding) VALUES (?,?)', (c.id, f32(vc)))
    built = datetime.now(timezone.utc).isoformat(timespec='seconds')
    meta = {'embedding': embedding, 'dims': str(dims), 'vector_backend': backend, 'built_at': built,
            'chunks': str(len(chunks)), 'contexts': json.dumps(ctx_stats)}
    con.executemany('INSERT INTO meta VALUES (?,?)', meta.items())
    con.commit()
    con.close()

    # Live website index: LSA embeddings of the contextual chunks (no model needed at runtime).
    live_vecs = lsa.embed(ctx_texts)
    LIVE_INDEX.parent.mkdir(parents=True, exist_ok=True)
    LIVE_INDEX.write_text(json.dumps({
        'version': 1,
        'builtAt': built,
        'embedding': 'lsa',
        'dims': int(lsa.components.shape[0]),
        'stopwords': sorted(STOPWORDS),
        'vocab': sorted(lsa.vocab, key=lsa.vocab.get),
        'idf': [round(float(x), 5) for x in lsa.idf],
        'components': [[round(float(x), 5) for x in row] for row in lsa.components],
        'chunks': [{'id': c.id, 'doc': c.doc, 'docTitle': c.doc_title, 'section': c.section, 'text': c.text,
                    'context': c.context, 'contextSource': c.context_source,
                    'vec': [round(float(x), 5) for x in v]} for c, v in zip(chunks, live_vecs)],
    }, ensure_ascii=False, separators=(',', ':')))
    write_golden()
    size = LIVE_INDEX.stat().st_size / 1024
    print(f'[ingest] data/rag.db: {len(chunks)} chunks, {dims}-dim {embedding} vectors in {backend}, FTS5 keyword index')
    print(f'[ingest] lib/rag/index.json for the live site: {size:.0f} KB')


if __name__ == '__main__':
    main()
