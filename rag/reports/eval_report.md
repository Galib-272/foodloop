# Ask FoodLoop: RAG evaluation

Run 2026-11-06T07:29:04+00:00 on Darwin arm64, Python 3.9.6. Index: 74 chunks, embeddings `ollama:nomic-embed-text`, vector store `numpy`, keyword search SQLite FTS5 (BM25), chunk contexts: {'llm_new': 74, 'llm_cached': 0, 'rules': 0, 'seconds': 82.4}.

## Retrieval (16 questions with a known source section)

| Chunks | Search | Hit@1 | Hit@3 | MRR |
|---|---|---|---|---|
| naive | vector | 75% | 100% | 0.865 |
| naive | keyword | 88% | 100% | 0.938 |
| naive | hybrid | 88% | 100% | 0.938 |
| contextual | vector | 62% | 81% | 0.762 |
| contextual | keyword | 62% | 94% | 0.786 |
| contextual | hybrid | 69% | 100% | 0.833 |
| contextual | graph | 75% | 94% | 0.842 |

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
| qwen2.5:1.5b | 81% | 62% | 100% | 0.97s | 76.4 |
| llama3.2:1b | 62% | 62% | 100% | 1.11s | 73.1 |
| deepseek-r1:1.5b | 6% | 6% | 100% | 6.25s | 71.5 |
| mistral:7b | 81% | 69% | 100% | 4.31s | 22.5 |
| auto (routing qwen2.5:1.5b / mistral:7b) | 75% | 56% | 100% | 1.87s | 21.3 |
