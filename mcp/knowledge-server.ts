#!/usr/bin/env node
/**
 * foodloop-knowledge-mcp — the Ask FoodLoop assistant as MCP tools (stdio).
 *   ask_foodloop           same answer as the Ask FoodLoop page: hybrid + graph search, cited sources, refusal when not covered
 *   search_knowledge       ranked knowledge-base passages with their vector / keyword / graph ranks
 *   query_knowledge_graph  read-only Cypher on the Kùzu knowledge graph (data/graph.kuzu)
 * Run: npx tsx mcp/knowledge-server.ts
 */
import { fail, json, log, tools, runPython } from './shared';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { ask, search } from '../lib/rag/search';
import { entities, facts } from '../lib/rag/graph';

const server = new McpServer({ name: 'foodloop-knowledge-mcp', version: '1.0.0' });
const RO = { readOnlyHint: true, openWorldHint: false };
const tool = tools(server);

tool('ask_foodloop', {
  title: 'Ask FoodLoop',
  description: 'Answer a question about FoodLoop (food safety rules, donation steps, roles, privacy, the AI models, data findings) only from FoodLoop\'s own documents and knowledge graph, with cited sources. Refuses questions the documents do not cover.',
  inputSchema: { question: z.string().min(3).max(500) },
  annotations: RO,
}, async ({ question }) => {
  const r = await ask(question);
  return json({ answer: r.answer, answered_by: r.generator, graph_facts: r.graphFacts,
    sources: r.hits.map((h, i) => ({ n: i + 1, document: h.docTitle, section: h.section, cited: r.citations.includes(i + 1) })), steps: r.trace });
});

tool('search_knowledge', {
  title: 'Search the FoodLoop knowledge base',
  description: 'Hybrid search (meaning + keyword + knowledge graph, fused with Reciprocal Rank Fusion) over FoodLoop\'s documents. Returns passages with their ranks.',
  inputSchema: { query: z.string().min(2).max(300), k: z.number().int().min(1).max(10).default(4) },
  annotations: RO,
}, async ({ query, k }) => {
  const e = entities(query);
  return json({ graph_entities: e, graph_facts: facts(e),
    passages: search(query, k).map((h) => ({ document: h.docTitle, section: h.section, text: h.text, context: h.context,
      vector_rank: h.vectorRank, keyword_rank: h.keywordRank, graph_rank: h.graphRank, fused_score: h.score })) });
});

tool('query_knowledge_graph', {
  title: 'Query the knowledge graph (Cypher)',
  description: 'Run one read-only Cypher query on the FoodLoop knowledge graph in Kùzu. Node table Entity(id, kind, key, label, description, terminal, aliases) with kinds role, action, status, category, storage, org_type, business_type, rule, concept; node table Chunk(id, doc, section). Relationships: CAN_PERFORM (role->action), REQUIRES_STATUS and RESULTS_IN (action->status), NEXT_STATUS (status->status), HAS_RULE, CHECKED_BY, IS_ROLE, MENTIONS (Chunk->Entity). Example: MATCH (r:Entity)-[:CAN_PERFORM]->(a:Entity {key: "confirm_delivery"}) RETURN r.label',
  inputSchema: { cypher: z.string().min(6).max(1000) },
  annotations: RO,
}, async ({ cypher }) => {
  const r = runPython('rag/graph_query.py', { cypher });
  return r.ok ? json(r.data) : fail(r.error ?? 'Query failed');
});

server.connect(new StdioServerTransport()).then(() => log('foodloop-knowledge-mcp ready on stdio'));
