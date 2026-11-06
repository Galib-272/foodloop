# Ask FoodLoop: RAG evaluation

Run 2026-11-06T05:37:44+00:00 on Linux x86_64, Python 3.13.16. Index: 76 chunks, embeddings `lsa`, vector store `sqlite-vec v0.1.9`, keyword search SQLite FTS5 (BM25), chunk contexts: {'llm_new': 0, 'llm_cached': 0, 'rules': 76, 'seconds': 0.0}.

## Retrieval (16 questions with a known source section)

| Chunks | Search | Hit@1 | Hit@3 | MRR |
|---|---|---|---|---|
| naive | vector | 75% | 100% | 0.865 |
| naive | keyword | 88% | 100% | 0.938 |
| naive | hybrid | 75% | 100% | 0.875 |
| contextual | vector | 69% | 100% | 0.844 |
| contextual | keyword | 75% | 100% | 0.865 |
| contextual | hybrid | 69% | 100% | 0.844 |
| contextual | graph | 81% | 94% | 0.875 |

## Graph RAG (Kùzu knowledge graph, 8 rule questions)

The graph returned the correct facts for **100%** of questions about who may do what and how a donation's status can change.

| Question | Entities found | Correct |
|---|---|---|
| Who can confirm delivery? | action:confirm_delivery | yes |
| Can a volunteer cancel a donation? | action:cancel_donation, role:volunteer | yes |
| What happens after a donor accepts a request? | action:accept_request, role:donor | yes |
| What can happen to a scheduled donation? | status:scheduled | yes |
| Which rules must an organization pass before matching? | concept:matching_rules, role:recipient | yes |
| When can food be marked as collected? | action:mark_collected, status:collected | yes |
| What can a volunteer do? | role:volunteer | yes |
| Is a delivered donation final? | status:delivered | yes |

## Local models

Not run: no Ollama models were available. Install Ollama, pull the models and run `npm run rag:eval`.
