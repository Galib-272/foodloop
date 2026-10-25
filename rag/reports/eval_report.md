# Ask FoodSphere: RAG evaluation

Run 2026-10-25T20:17:35+00:00 on Linux x86_64, Python 3.13.16. Index: 72 chunks, embeddings `lsa`, vector store `sqlite-vec v0.1.9`, keyword search SQLite FTS5 (BM25), chunk contexts: {'llm_new': 0, 'llm_cached': 0, 'rules': 72, 'seconds': 0.0}.

## Retrieval (16 questions with a known source section)

| Chunks | Search | Hit@1 | Hit@3 | MRR |
|---|---|---|---|---|
| naive | vector | 69% | 100% | 0.823 |
| naive | keyword | 81% | 100% | 0.896 |
| naive | hybrid | 69% | 100% | 0.833 |
| contextual | vector | 69% | 100% | 0.833 |
| contextual | keyword | 69% | 100% | 0.844 |
| contextual | hybrid | 69% | 100% | 0.833 |

## Local models

Not run: no Ollama models were available. Install Ollama, pull the models and run `npm run rag:eval`.
