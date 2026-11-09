# Ask FoodLoop: RAG evaluation

Run 2026-11-09T12:07:41+00:00 on Darwin arm64, Python 3.9.6. Index: 75 chunks, embeddings `ollama:nomic-embed-text`, vector store `numpy`, keyword search SQLite FTS5 (BM25), chunk contexts: {'llm_new': 6, 'llm_cached': 69, 'rules': 0, 'seconds': 31.9}.

## Retrieval (16 questions with a known source section)

| Chunks | Search | Hit@1 | Hit@3 | MRR |
|---|---|---|---|---|
| naive | vector | 88% | 100% | 0.938 |
| naive | keyword | 88% | 100% | 0.938 |
| naive | hybrid | 94% | 100% | 0.969 |
| contextual | vector | 62% | 88% | 0.778 |
| contextual | keyword | 69% | 100% | 0.833 |
| contextual | hybrid | 69% | 100% | 0.833 |
| contextual | graph | 75% | 100% | 0.865 |

## Graph RAG (Kùzu knowledge graph, 9 rule questions)

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
| Which allergens should donors list? | rule:list_allergens, role:donor | yes |

## Local models through the LangGraph agent (18 questions, 2 out of scope)

| Model | Answer accuracy | Cites sources | Refuses out-of-scope | Median time | Tokens/s |
|---|---|---|---|---|---|
| qwen2.5:1.5b | 94% | 56% | 100% | 0.825s | 87.2 |
| llama3.2:1b | 75% | 69% | 100% | 0.815s | 74.35 |
| deepseek-r1:1.5b | 75% | 38% | 100% | 10.73s | 64.25 |
| mistral:7b | 100% | 75% | 100% | 4.29s | 23.3 |
| auto (routing qwen2.5:1.5b / mistral:7b) | 100% | 44% | 100% | 1.8849999999999998s | 73.45 |
