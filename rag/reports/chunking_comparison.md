# Fixed vs semantic chunking

Embeddings: `lsa`. Same test questions as `eval_report.md`.

| Chunking | Chunks | Avg chars | Duplicates removed | Chunk text | Search | Hit@1 | Hit@3 | MRR |
|---|---|---|---|---|---|---|---|---|
| fixed | 72 | 284 | 0 | naive | vector | 69% | 100% | 0.823 |
| fixed | 72 | 284 | 0 | naive | keyword | 81% | 100% | 0.896 |
| fixed | 72 | 284 | 0 | naive | hybrid | 69% | 100% | 0.833 |
| fixed | 72 | 284 | 0 | contextual | vector | 69% | 100% | 0.833 |
| fixed | 72 | 284 | 0 | contextual | keyword | 69% | 100% | 0.844 |
| fixed | 72 | 284 | 0 | contextual | hybrid | 69% | 100% | 0.833 |
| semantic | 76 | 263 | 0 | naive | vector | 75% | 100% | 0.865 |
| semantic | 76 | 263 | 0 | naive | keyword | 88% | 100% | 0.938 |
| semantic | 76 | 263 | 0 | naive | hybrid | 75% | 100% | 0.875 |
| semantic | 76 | 263 | 0 | contextual | vector | 69% | 100% | 0.844 |
| semantic | 76 | 263 | 0 | contextual | keyword | 75% | 100% | 0.865 |
| semantic | 76 | 263 | 0 | contextual | hybrid | 69% | 100% | 0.844 |
