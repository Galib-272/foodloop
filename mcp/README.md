# FoodLoop MCP servers

Three Model Context Protocol servers (stdio, official MCP TypeScript SDK). They reuse the web app's own code and data,
so an AI assistant gets exactly the answers the website gives.

| Server | Tools | Uses |
|---|---|---|
| `foodloop-forecast-mcp` | `predict_leftover`, `predict_waste_risk`, `rank_organizations`, `get_model_metrics` | `lib/model/*.json`, `lib/ml`, `lib/matching.ts`, the local app database |
| `foodloop-knowledge-mcp` | `ask_foodloop`, `search_knowledge`, `query_knowledge_graph` | `lib/rag` (hybrid + graph search), Kùzu graph `data/graph.kuzu` |
| `foodloop-warehouse-mcp` | `list_reports`, `get_report`, `run_readonly_query` | DuckDB warehouse, Delta Lake summary |

All tools are read-only (`readOnlyHint`). Cypher and SQL tools accept one read-only query, open the database read-only and return at most 200 rows.
Inputs are validated with zod. Nothing is written and no donation is ever created.

## Run and test
```bash
npm run py:setup && npm run rag:ingest && npm run warehouse   # once: builds the graph and warehouse the servers read
npm run test:mcp                                               # MCP client starts all three servers and calls every tool
npx @modelcontextprotocol/inspector npx tsx mcp/forecast-server.ts   # optional: try the tools in MCP Inspector
```

## Use in Claude Desktop
Copy the entries from `claude_desktop_config.example.json` into Claude Desktop → Settings → Developer → Edit Config
(`~/Library/Application Support/Claude/claude_desktop_config.json` on Mac). If Claude cannot find `node`,
replace `"node"` with the full path printed by `which node`. Restart Claude Desktop, then ask for example:
"Use foodloop-forecast to predict leftovers for 140 portions of prepared food on a rainy Monday."
