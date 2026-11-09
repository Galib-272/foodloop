# Ask FoodLoop: RAG evaluation

Run 2026-11-09T11:46:58+00:00 on Darwin arm64, Python 3.9.6. Index: 75 chunks, embeddings `ollama:nomic-embed-text`, vector store `numpy`, keyword search SQLite FTS5 (BM25), chunk contexts: {'llm_new': 14, 'llm_cached': 61, 'rules': 0, 'seconds': 41.5}.

## Retrieval (16 questions with a known source section)

| Chunks | Search | Hit@1 | Hit@3 | MRR |
|---|---|---|---|---|
| naive | vector | 81% | 100% | 0.906 |
| naive | keyword | 88% | 100% | 0.938 |
| naive | hybrid | 94% | 100% | 0.969 |
| contextual | vector | 69% | 88% | 0.809 |
| contextual | keyword | 62% | 100% | 0.792 |
| contextual | hybrid | 75% | 100% | 0.865 |
| contextual | graph | 81% | 94% | 0.872 |

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

## Local models through the LangGraph agent (18 questions, 2 out of scope)

| Model | Answer accuracy | Cites sources | Refuses out-of-scope | Median time | Tokens/s |
|---|---|---|---|---|---|
| qwen2.5:1.5b | 88% | 62% | 100% | 0.875s | 86.55000000000001 |
| llama3.2:1b | 69% | 56% | 100% | 0.815s | 73.85 |
| deepseek-r1:1.5b | 75% | 25% | 100% | 10.280000000000001s | 73.05 |
| mistral:7b | 88% | 75% | 100% | 4.245s | 23.0 |
| auto (routing qwen2.5:1.5b / mistral:7b) | 88% | 50% | 100% | 1.895s | 83.30000000000001 |
