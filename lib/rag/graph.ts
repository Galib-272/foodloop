import graph from './graph.json';

/**
 * Graph RAG for the web app. lib/rag/graph.json is exported from the Kùzu knowledge graph (rag/build_graph.py) and
 * this file mirrors rag/graph_rag.py: find the entities named in a question, turn their neighbourhood into short
 * facts, and rank the knowledge-base chunks that mention them. lib/rag/golden.json checks parity with Python/Kùzu.
 */

type Node = (typeof graph.nodes)[number];
const NODES = new Map<string, Node>(graph.nodes.map((n) => [n.id, n]));
const PRIORITY: Record<string, number> = { action: 0, status: 1, concept: 2, rule: 2, category: 3, storage: 3, org_type: 4, business_type: 4, role: 5 };
const MAX_ENTITIES = 4;
const MAX_FACTS = 6;

const OUT = new Map<string, string[]>();
const IN = new Map<string, string[]>();
for (const e of graph.edges) {
  const o = `${e.type}|${e.from}`;
  const i = `${e.type}|${e.to}`;
  OUT.set(o, [...(OUT.get(o) ?? []), e.to]);
  IN.set(i, [...(IN.get(i) ?? []), e.from]);
}
const labels = (ids: string[] | undefined) => (ids ?? []).map((id) => NODES.get(id)!.label).sort(cmp);
const out = (rel: string, id: string) => labels(OUT.get(`${rel}|${id}`));
const into = (rel: string, id: string) => labels(IN.get(`${rel}|${id}`));
const join = (xs: string[]) => (xs.length ? xs.join(', ') : 'none');
function cmp(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

const ALIAS_RE = new Map<string, RegExp[]>(
  graph.nodes.map((n) => [n.id, n.aliases.filter((a) => a.length > 3).map((a) => new RegExp(`(?<![a-z])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z])`))])
);

export function entities(question: string): string[] {
  const low = ` ${question.toLowerCase()} `;
  return graph.nodes
    .filter((n) => n.kind in PRIORITY && ALIAS_RE.get(n.id)!.some((re) => re.test(low)))
    .map((n) => n.id)
    .sort((a, b) => (PRIORITY[NODES.get(a)!.kind] - PRIORITY[NODES.get(b)!.kind]) || cmp(a, b))
    .slice(0, MAX_ENTITIES);
}

export function fact(id: string): string {
  const n = NODES.get(id)!;
  switch (n.kind) {
    case 'action': {
      let s = `${n.label}: done by ${join(into('CAN_PERFORM', id))}.`;
      const req = out('REQUIRES_STATUS', id);
      const to = out('RESULTS_IN', id);
      const rules = out('HAS_RULE', id);
      if (req.length) s += ` Allowed when the donation is ${join(req)}.`;
      if (to.length) s += ` Afterwards the donation is ${join(to)}.`;
      if (rules.length) s += ` Checks: ${join(rules)}.`;
      return s;
    }
    case 'status': {
      const s = n.terminal ? `${n.label} is a final status.` : `${n.label} can change to: ${join(out('NEXT_STATUS', id))}.`;
      const acts = into('REQUIRES_STATUS', id);
      return s + (acts.length ? ` Possible actions: ${join(acts)}.` : '');
    }
    case 'role':
      return `${n.label} can: ${join(out('CAN_PERFORM', id))}.`;
    case 'concept':
      return `Before AI ranking, every organization must pass: ${join(out('HAS_RULE', id))}.`;
    case 'rule':
      return `${n.label}: ${n.description}`;
    case 'category':
      return `${n.label} donations go only to organizations that accept ${n.label} (rule: ${join(out('CHECKED_BY', id))}).`;
    case 'storage':
      return `${n.label} food goes only to organizations with that storage (rule: ${join(out('CHECKED_BY', id))}).`;
    case 'org_type':
      return `${n.label} is a type of ${join(out('IS_ROLE', id))}.`;
    case 'business_type':
      return `${n.label} is a ${join(out('IS_ROLE', id))} business type.`;
    default:
      return n.label;
  }
}

export function facts(ids: string[]): string[] {
  return ids.map(fact).slice(0, MAX_FACTS);
}

/** Chunk ids that mention the most of these entities (ties: lower id). */
export function graphChunks(ids: string[], k = 20): number[] {
  if (!ids.length) return [];
  const want = new Set(ids);
  const count = new Map<number, number>();
  for (const [chunk, entity] of graph.mentions) {
    if (!want.has(entity)) continue;
    const cid = Number(chunk.split(':')[1]);
    count.set(cid, (count.get(cid) ?? 0) + 1);
  }
  return Array.from(count).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, k).map(([cid]) => cid);
}

