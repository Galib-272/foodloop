# AGENTS.md — rules for AI coding agents working on FoodLoop

FoodLoop predicts surplus food and matches it to NGOs, shelters and community kitchens.
This file tells any AI agent (Claude, Codex, Cursor…) how to work in this repository.

## Workflow
1. **Plan first.** Explain the plan and wait for human approval before large changes.
2. Build in small steps; one logical change per commit (`feat:`, `fix:`, `docs:`, `chore:` …).
3. After each step run the checks below and look at the live preview before moving on.
4. Never push secrets. `.env.local`, `data/`, `.venv/` and n8n data are git-ignored.

## Checks (must pass before every commit)
| Command | What it proves |
|---|---|
| `npx tsc --noEmit` | the web app type-checks |
| `npm run test:parity` | TypeScript ML inference equals scikit-learn |
| `npm run test:rag` | TypeScript assistant search equals the Python reference |
| `npm run test:mcp` | the three MCP servers answer like the web app |
| `npm run test:ocr` | photo OCR (Tesseract) + AI extraction fill a donation correctly |
| `npm run build` | production build works |

## Project map
- `app/`, `components/`, `lib/` — Next.js 13 app (App Router), SQLite locally / Turso in production.
- `lib/ml/` — runs the exported models (`lib/model/*.json`) in TypeScript. Do not edit the JSON by hand.
- `ml/waste`, `ml/matching` — notebooks that train and export the two models. Retrain there, never in the app.
- `ml/warehouse` — DuckDB warehouse and Delta Lake layers (offline analytics).
- `rag/` — knowledge base, semantic chunking, sqlite-vec + FTS5, Kùzu knowledge graph, LangGraph agent, eval.
- `mcp/` — FoodLoop MCP servers (stdio, TypeScript SDK).
- `automation/n8n` — n8n alert workflow and runner.

## Data and AI rules
- **No data leakage:** split by date, fit preprocessing on training data only, use the test set once.
- Always report a **baseline** next to any model score. Never tune on the test set.
- Synthetic data must stay labelled `SYNTHETIC` (file names, columns, docs).
- The AI never creates or publishes a donation by itself; a person confirms.
- Safety rules (deadline, category, storage, capacity) run **before** any AI ranking.
- The assistant answers only from `rag/knowledge` and must cite sources or refuse.
- Personal data (phones, addresses) is never sent to an AI model or put in logs.

## Style
- TypeScript strict, Zod for every API input, `apiUser()` for auth, `audit()` for state changes.
- Plain, short UI text. Every AI output shows that it is an estimate.
- Python 3.9+ compatible; run Python through `node scripts/py.mjs` (uses `.venv`).
