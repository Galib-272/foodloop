# Ask FoodLoop: RAG evaluation

Run 2026-11-06T05:31:14+00:00 on Linux x86_64, Python 3.13.16. Index: 76 chunks, embeddings `lsa`, vector store `sqlite-vec v0.1.9`, keyword search SQLite FTS5 (BM25), chunk contexts: {'llm_new': 0, 'llm_cached': 0, 'rules': 76, 'seconds': 0.0}.

## Retrieval (16 questions with a known source section)

| Chunks | Search | Hit@1 | Hit@3 | MRR |
|---|---|---|---|---|
| naive | vector | 75% | 100% | 0.865 |
| naive | keyword | 88% | 100% | 0.938 |
| naive | hybrid | 75% | 100% | 0.875 |
| contextual | vector | 69% | 100% | 0.844 |
| contextual | keyword | 75% | 100% | 0.865 |
| contextual | hybrid | 69% | 100% | 0.844 |

## Local models

Not run: no Ollama models were available. Install Ollama, pull the models and run `npm run rag:eval`.
