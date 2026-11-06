/* Starts the three FoodLoop MCP servers over stdio with the official MCP client, lists their tools, calls every tool
   and checks the answers against the web app's own functions. Run: npm run test:mcp */
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { predictWaste } from '../lib/ml/waste';
import { ask } from '../lib/rag/search';

const ROOT = path.resolve(__dirname, '..');
const TSX = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
let failed = 0;
const check = (ok: boolean, msg: string) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failed++; };

async function connect(file: string) {
  const client = new Client({ name: 'foodloop-mcp-test', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: TSX, args: [path.join(ROOT, 'mcp', file)], cwd: ROOT, stderr: 'ignore' }));
  return client;
}
const data = (r: unknown) => (r as { structuredContent?: Record<string, any> }).structuredContent ?? {};
const isErr = (r: unknown) => Boolean((r as { isError?: boolean }).isError);

async function main() {
  // ---- forecast server
  const f = await connect('forecast-server.ts');
  const ft = (await f.listTools()).tools.map((t) => t.name).sort();
  check(JSON.stringify(ft) === JSON.stringify(['get_model_metrics', 'predict_leftover', 'predict_waste_risk', 'rank_organizations']), `forecast server tools: ${ft.join(', ')}`);
  const args = { food_category: 'Prepared Food', date: '2026-11-10', purchase_quantity: 140, business_type: 'Restaurant', weather: 'Rainy', promotion: false };
  const web = predictWaste({ ...args, promotion: 0 });
  const lo = data(await f.callTool({ name: 'predict_leftover', arguments: args }));
  check(lo.leftover_units === web.leftover && lo.range_80[0] === web.lower && lo.range_80[1] === web.upper,
    `predict_leftover = web app (${lo.leftover_units} units, range ${lo.range_80})`);
  const risk = data(await f.callTool({ name: 'predict_waste_risk', arguments: args }));
  check(risk.waste_risk === web.waste_level && JSON.stringify(risk.probabilities) === JSON.stringify(web.probabilities), `predict_waste_risk = web app (${risk.waste_risk})`);
  const rank = data(await f.callTool({ name: 'rank_organizations', arguments: { food_category: 'Prepared Food', quantity: 40, unit: 'portions', hours_until_deadline: 8 } }));
  check(Array.isArray(rank.ranked) && rank.ranked.length > 0 && rank.ranked.every((r: any, i: number, a: any[]) => i === 0 || a[i - 1].score >= r.score),
    `rank_organizations: ${rank.eligible} eligible, top "${rank.ranked?.[0]?.organization}" (${rank.ranked?.[0]?.score}), ${rank.excluded?.length} excluded by safety rules`);
  const frozen = data(await f.callTool({ name: 'rank_organizations', arguments: { food_category: 'Dairy', quantity: 5, unit: 'kg', storage_requirement: 'frozen', hours_until_deadline: 24 } }));
  const noFreezer = (frozen.excluded ?? []).filter((x: any) => /frozen storage/.test(x.reason)).map((x: any) => x.organization);
  check(noFreezer.length > 0 && frozen.ranked.every((r: any) => !noFreezer.includes(r.organization)),
    `safety rules run before AI ranking: excluded for no freezer -> ${noFreezer.join(', ')}`);
  const m = data(await f.callTool({ name: 'get_model_metrics', arguments: {} }));
  check(m.waste?.waste_level_classification?.accuracy > 0.7 && m.matching?.test?.accuracy > 0.8, 'get_model_metrics returns both models');
  check(isErr(await f.callTool({ name: 'predict_leftover', arguments: { ...args, food_category: 'Pizza' } })), 'invalid input is rejected');
  await f.close();

  // ---- knowledge server
  const k = await connect('knowledge-server.ts');
  const kt = (await k.listTools()).tools.map((t) => t.name).sort();
  check(JSON.stringify(kt) === JSON.stringify(['ask_foodloop', 'query_knowledge_graph', 'search_knowledge']), `knowledge server tools: ${kt.join(', ')}`);
  const q = 'Can a volunteer cancel a donation?';
  const a = data(await k.callTool({ name: 'ask_foodloop', arguments: { question: q } }));
  const webAns = await ask(q);
  check(a.answer === webAns.answer && a.answer.includes('done by Administrator, Donor'), `ask_foodloop = Ask FoodLoop page: "${a.answer.slice(0, 70)}…"`);
  const out = data(await k.callTool({ name: 'ask_foodloop', arguments: { question: 'What is the capital of France?' } }));
  check(out.answered_by === 'refusal', 'ask_foodloop refuses out-of-scope questions');
  const s = data(await k.callTool({ name: 'search_knowledge', arguments: { query: 'refrigerated food temperature', k: 3 } }));
  check(s.passages?.length === 3 && /5°C/.test(s.passages[0].text), `search_knowledge top passage: ${s.passages?.[0]?.document} > ${s.passages?.[0]?.section}`);
  const g = await k.callTool({ name: 'query_knowledge_graph', arguments: { cypher: 'MATCH (r:Entity)-[:CAN_PERFORM]->(a:Entity {key: "confirm_delivery"}) RETURN r.label ORDER BY r.label' } });
  check(!isErr(g) && JSON.stringify(data(g).rows) === JSON.stringify([['Administrator'], ['Recipient Organization']]), `query_knowledge_graph (Kùzu Cypher): ${JSON.stringify(data(g).rows)}`);
  const w = await k.callTool({ name: 'query_knowledge_graph', arguments: { cypher: 'MATCH (n:Entity) DETACH DELETE n' } });
  check(isErr(w), 'query_knowledge_graph blocks write queries');
  await k.close();

  // ---- warehouse server
  const h = await connect('warehouse-server.ts');
  const ht = (await h.listTools()).tools.map((t) => t.name).sort();
  check(JSON.stringify(ht) === JSON.stringify(['get_report', 'list_reports', 'run_readonly_query']), `warehouse server tools: ${ht.join(', ')}`);
  const l = data(await h.callTool({ name: 'list_reports', arguments: {} }));
  check(l.reports?.length >= 10, `list_reports: ${l.reports?.length} reports`);
  const rep = data(await h.callTool({ name: 'get_report', arguments: { name: 'waste_by_category' } }));
  check(rep.rows?.[0]?.food_category === 'Prepared Food' || rep.rows?.length === 6, `get_report waste_by_category: ${rep.rows?.length} rows`);
  const sql = await h.callTool({ name: 'run_readonly_query', arguments: { sql: 'SELECT c.category_name, ROUND(SUM(f.waste_quantity)) AS wasted FROM fact_inventory_waste f JOIN dim_food_category c USING (category_key) GROUP BY 1 ORDER BY 2 DESC LIMIT 3' } });
  check(!isErr(sql) && data(sql).rows?.length === 3, `run_readonly_query (DuckDB): ${JSON.stringify(data(sql).rows)}`);
  check(isErr(await h.callTool({ name: 'run_readonly_query', arguments: { sql: 'DROP TABLE dim_date' } })), 'run_readonly_query blocks writes');
  await h.close();

  console.log(failed ? `\n${failed} MCP CHECK(S) FAILED` : '\nALL MCP CHECKS PASSED');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
