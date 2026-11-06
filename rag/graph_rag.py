"""
Graph RAG over the Kùzu knowledge graph (data/graph.kuzu, built by rag/build_graph.py).

  entities(question)  find roles, actions, statuses, categories, storage and rules named in the question
  facts(entities)     turn their graph neighbourhood into short facts, e.g.
                      "Confirm delivery: done by Administrator, Recipient Organization. Allowed when the donation is Collected. ..."
  chunks(entities)    knowledge-base chunks that MENTION those entities (a third ranking for hybrid search)

The same logic runs on the live website from lib/rag/graph.json (lib/rag/graph.ts); lib/rag/golden.json checks parity.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Dict, List

import kuzu

ROOT = Path(__file__).resolve().parents[1]
GRAPH_DB = ROOT / 'data/graph.kuzu'
PRIORITY = {'action': 0, 'status': 1, 'concept': 2, 'rule': 2, 'category': 3, 'storage': 3, 'org_type': 4,
            'business_type': 4, 'role': 5}
MAX_ENTITIES, MAX_FACTS = 4, 6


def join(items: List[str]) -> str:
    return ', '.join(items) if items else 'none'


class Graph:
    def __init__(self, path: Path = GRAPH_DB):
        if not path.exists():
            raise SystemExit('[graph] data/graph.kuzu not found. Run: npm run rag:ingest')
        self.db = kuzu.Database(str(path), read_only=True)
        self.con = kuzu.Connection(self.db)
        rows = self.q('MATCH (n:Entity) RETURN n.id, n.kind, n.label, n.description, n.terminal, n.aliases')
        self.nodes = {r[0]: {'id': r[0], 'kind': r[1], 'label': r[2], 'description': r[3], 'terminal': r[4], 'aliases': r[5]} for r in rows}

    def q(self, cypher: str, params: Dict = None) -> list:
        res = self.con.execute(cypher, params or {})
        out = []
        while res.has_next():
            out.append(res.get_next())
        return out

    def out(self, rel: str, src: str) -> List[str]:
        return sorted(r[0] for r in self.q(f'MATCH (a:Entity {{id: $s}})-[:{rel}]->(b:Entity) RETURN b.label', {'s': src}))

    def into(self, rel: str, dst: str) -> List[str]:
        return sorted(r[0] for r in self.q(f'MATCH (a:Entity)-[:{rel}]->(b:Entity {{id: $d}}) RETURN a.label', {'d': dst}))

    # ---- entity linking
    def entities(self, question: str) -> List[str]:
        low = f' {question.lower()} '
        found = []
        for n in self.nodes.values():
            if n['kind'] == 'concept' or n['kind'] in PRIORITY:
                if any(len(a) > 3 and re.search(rf'(?<![a-z]){re.escape(a)}(?![a-z])', low) for a in n['aliases']):
                    found.append(n['id'])
        found.sort(key=lambda i: (PRIORITY.get(self.nodes[i]['kind'], 9), i))
        return found[:MAX_ENTITIES]

    # ---- facts from the neighbourhood of each entity
    def fact(self, eid: str) -> str:
        n, kind = self.nodes[eid], self.nodes[eid]['kind']
        if kind == 'action':
            to = self.out('RESULTS_IN', eid)
            s = f"{n['label']}: done by {join(self.into('CAN_PERFORM', eid))}."
            req = self.out('REQUIRES_STATUS', eid)
            if req:
                s += f" Allowed when the donation is {join(req)}."
            if to:
                s += f" Afterwards the donation is {join(to)}."
            rules = self.out('HAS_RULE', eid)
            if rules:
                s += f" Checks: {join(rules)}."
            return s
        if kind == 'status':
            nxt = self.out('NEXT_STATUS', eid)
            s = f"{n['label']} is a final status." if n['terminal'] else f"{n['label']} can change to: {join(nxt)}."
            acts = self.into('REQUIRES_STATUS', eid)
            return s + (f" Possible actions: {join(acts)}." if acts else '')
        if kind == 'role':
            return f"{n['label']} can: {join(self.out('CAN_PERFORM', eid))}."
        if kind == 'concept':
            return f"Before AI ranking, every organization must pass: {join(self.out('HAS_RULE', eid))}."
        if kind == 'rule':
            return f"{n['label']}: {n['description']}"
        if kind == 'category':
            return f"{n['label']} donations go only to organizations that accept {n['label']} (rule: {join(self.out('CHECKED_BY', eid))})."
        if kind == 'storage':
            return f"{n['label']} food goes only to organizations with that storage (rule: {join(self.out('CHECKED_BY', eid))})."
        if kind == 'org_type':
            return f"{n['label']} is a type of {join(self.out('IS_ROLE', eid))}."
        if kind == 'business_type':
            return f"{n['label']} is a {join(self.out('IS_ROLE', eid))} business type."
        return n['label']

    def facts(self, eids: List[str]) -> List[str]:
        return [self.fact(e) for e in eids][:MAX_FACTS]

    def chunks(self, eids: List[str], k: int = 20) -> List[int]:
        """Chunks mentioning the most question entities first (ties: lower id)."""
        if not eids:
            return []
        rows = self.q('MATCH (c:Chunk)-[:MENTIONS]->(e:Entity) WHERE e.id IN $ids RETURN c.id, count(e) AS n', {'ids': eids})
        rows.sort(key=lambda r: (-r[1], int(r[0].split(':')[1])))
        return [int(r[0].split(':')[1]) for r in rows[:k]]


if __name__ == '__main__':
    import sys
    g = Graph()
    q = ' '.join(sys.argv[1:]) or 'What happens after a donor accepts a request?'
    e = g.entities(q)
    print('entities:', e)
    for f in g.facts(e):
        print(' -', f)
    print('chunks:', g.chunks(e)[:8])
