"""
Builds the FoodLoop knowledge graph in Kùzu (embedded graph database, Cypher) for Graph RAG.

Facts come from the app's own code, so the graph always matches how the app behaves:
  lib/constants.ts   roles, donation statuses, food categories, storage, organization and business types
  lib/donations.ts   TRANSITIONS (which status can follow which)
  API role checks    which role may perform each donation action (listed in ACTIONS below)
  lib/matching.ts    the safety and eligibility rules checked before AI ranking
Each knowledge-base chunk in data/rag.db is linked to the entities it mentions (MENTIONS).

Output: data/graph.kuzu (Kùzu database) and lib/rag/graph.json (same graph for the live website).
Run: node scripts/py.mjs rag/build_graph.py      (after rag/ingest.py)
"""
from __future__ import annotations

import json
import re
import shutil
import sqlite3
import sys
from pathlib import Path

import kuzu

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import DB_PATH, ROOT  # noqa: E402

GRAPH_DB = ROOT / 'data/graph.kuzu'
GRAPH_JSON = ROOT / 'lib/rag/graph.json'

const_ts = (ROOT / 'lib/constants.ts').read_text()
don_ts = (ROOT / 'lib/donations.ts').read_text()


def ts_array(name: str, src: str = const_ts) -> list:
    body = re.search(rf'export const {name}[^=]*=\s*\[(.*?)\]', src, re.S).group(1)
    return re.findall(r"'([^']+)'", body)


def ts_record(name: str, src: str = const_ts) -> dict:
    body = re.search(rf'export const {name}[^=]*=\s*\{{(.*?)\}};', src, re.S).group(1)
    return {k.strip(): v for k, v in re.findall(r"'?([\w ]+)'?\s*:\s*'([^']*)'", body)}


STATUSES = ts_array('DONATION_STATUSES')
STATUS_LABEL = ts_record('DONATION_STATUS_LABEL')
TERMINAL = set(ts_array('TERMINAL_STATUSES'))
CATEGORIES = ts_array('FOOD_CATEGORIES')
STORAGE_LABEL = ts_record('STORAGE_LABEL')
ORG_TYPES = ts_array('ORG_TYPES')
BUSINESS = ts_record('MODEL_BUSINESS_TYPE')
TRANSITIONS = {k: re.findall(r"'(\w+)'", v) for k, v in
               re.findall(r"^\s*(\w+): \[([^\]]*)\],", re.search(r'TRANSITIONS[^=]*= \{(.*?)\n\};', don_ts, re.S).group(1), re.M)}
ROLE_LABEL = ts_record('ROLE_LABEL')

# Donation actions: who may do them (API role checks) and which statuses they need / produce (lib/donations.ts).
ACTIONS = [
    ('publish_donation', 'Publish a donation', ['donor'], [], 'available',
     'The donor lists surplus food with quantity, category, storage, pickup window and safe-use deadline.'),
    ('request_donation', 'Request a donation', ['recipient'], ['available', 'requested'], 'requested',
     'A verified organization asks for an available donation before its safe-use deadline.'),
    ('send_offer', 'Offer to an organization', ['donor', 'admin'], ['available', 'requested'], None,
     'The donor offers the food directly to a recommended organization.'),
    ('accept_request', 'Accept a request', ['donor', 'admin'], ['requested'], 'accepted',
     'The donor accepts one request; the pickup address is then shared with that organization.'),
    ('reject_request', 'Reject a request', ['donor', 'admin'], ['requested'], None,
     'The donor declines a request; the donation stays open for others.'),
    ('schedule_collection', 'Schedule the collection', ['donor', 'recipient', 'admin'], ['accepted', 'scheduled'], 'scheduled',
     'A pickup time is agreed and a volunteer can be requested.'),
    ('mark_collected', 'Mark food as collected', ['donor', 'recipient', 'volunteer', 'admin'], ['scheduled'], 'collected',
     'The food has been picked up.'),
    ('confirm_delivery', 'Confirm delivery', ['recipient', 'admin'], ['collected'], 'delivered',
     'The receiving organization confirms the quantity received.'),
    ('report_failure', 'Report a failed collection', ['donor', 'recipient', 'volunteer', 'admin'], ['accepted', 'scheduled', 'collected'], 'failed',
     'A party reports that the pickup or delivery failed, with a reason.'),
    ('cancel_donation', 'Cancel a donation', ['donor', 'admin'], ['available', 'requested', 'accepted', 'scheduled'], 'cancelled',
     'The donor withdraws the donation before it is collected.'),
    ('volunteer_task', 'Claim and carry out a volunteer task', ['volunteer'], ['scheduled', 'collected'], None,
     'A volunteer claims an open pickup task, collects the food and delivers it.'),
    ('verify_organization', 'Verify an organization', ['admin'], [], None,
     'Admins check registration documents; only verified organizations can receive food.'),
    ('expire_donation', 'Expire automatically', ['system'], ['available', 'requested', 'accepted', 'scheduled'], 'expired',
     'The system marks food Expired when its safe-use deadline passes.'),
]

RULES = [
    ('verified_only', 'Only verified organizations', 'Organizations must be verified by an admin before they can be matched or receive food.'),
    ('accepts_category', 'Accepts the food category', 'The organization must list the donation\'s food category as accepted.'),
    ('has_storage', 'Has the required storage', 'The organization must have the storage the food needs (ambient, refrigerated or frozen).'),
    ('before_deadline', 'Can receive before the deadline', 'The organization must be able to receive the food before its safe-use deadline.'),
    ('has_capacity', 'Has capacity today', 'The organization must have remaining receiving capacity today.'),
]

ALIASES = {
    'role:donor': ['donor', 'donors', 'restaurant', 'restaurants', 'business', 'businesses'],
    'role:recipient': ['recipient', 'recipients', 'organization', 'organizations', 'ngo', 'ngos', 'charity', 'charities'],
    'role:volunteer': ['volunteer', 'volunteers', 'driver', 'drivers'],
    'role:admin': ['admin', 'admins', 'administrator', 'administrators'],
    'action:publish_donation': ['publish', 'list a donation', 'create a donation', 'post a donation', 'new donation'],
    'action:request_donation': ['request a donation', 'request food', 'ask for food', 'requests a donation', 'request it'],
    'action:send_offer': ['offer', 'offers'],
    'action:accept_request': ['accept a request', 'accepts a request', 'accepted request', 'accept the request', 'accepts the request'],
    'action:reject_request': ['reject a request', 'decline a request', 'rejects a request'],
    'action:schedule_collection': ['schedule', 'pickup time', 'collection time'],
    'action:mark_collected': ['collected', 'mark collected', 'picked up'],  # not 'pickup': too common in other questions
    'action:confirm_delivery': ['confirm delivery', 'confirm receipt', 'confirms delivery', 'delivery confirmed'],
    'action:report_failure': ['fail', 'fails', 'failed', 'failure', 'goes wrong', 'went wrong'],
    'action:cancel_donation': ['cancel', 'cancelled', 'canceled', 'withdraw'],
    'action:volunteer_task': ['task', 'tasks', 'claim'],
    'action:verify_organization': ['verify', 'verified', 'verification'],
    'action:expire_donation': ['expire', 'expires', 'expired', 'deadline passes'],
    'concept:matching_rules': ['match', 'matched', 'matching', 'eligible', 'eligibility', 'excluded', 'ranked', 'ranking'],
}


def build() -> dict:
    nodes, edges = [], []
    add = lambda kind, key, label, **p: nodes.append({'id': f'{kind}:{key}', 'kind': kind, 'key': key, 'label': label, **p})  # noqa: E731
    for r, label in ROLE_LABEL.items():
        add('role', r, label)
    add('role', 'system', 'System (automatic)')
    for s in STATUSES:
        add('status', s, STATUS_LABEL.get(s, s.title()), terminal=s in TERMINAL)
    for key, label, roles, frm, to, desc in ACTIONS:
        add('action', key, label, description=desc)
        edges += [{'type': 'CAN_PERFORM', 'from': f'role:{r}', 'to': f'action:{key}'} for r in roles]
        edges += [{'type': 'REQUIRES_STATUS', 'from': f'action:{key}', 'to': f'status:{s}'} for s in frm]
        if to:
            edges.append({'type': 'RESULTS_IN', 'from': f'action:{key}', 'to': f'status:{to}'})
    for frm, tos in TRANSITIONS.items():
        edges += [{'type': 'NEXT_STATUS', 'from': f'status:{frm}', 'to': f'status:{t}'} for t in tos]
    for c in CATEGORIES:
        add('category', c, c)
    for s, label in STORAGE_LABEL.items():
        add('storage', s, label)
    for o in ORG_TYPES:
        add('org_type', o, o)
        edges.append({'type': 'IS_ROLE', 'from': f'org_type:{o}', 'to': 'role:recipient'})
    for b, model_b in BUSINESS.items():
        add('business_type', b, b, model_type=model_b)
        edges.append({'type': 'IS_ROLE', 'from': f'business_type:{b}', 'to': 'role:donor'})
    add('concept', 'matching_rules', 'Safety and eligibility rules (checked before AI ranking)')
    for key, label, text in RULES:
        add('rule', key, label, description=text)
        edges.append({'type': 'HAS_RULE', 'from': 'concept:matching_rules', 'to': f'rule:{key}'})
    edges.append({'type': 'HAS_RULE', 'from': 'action:request_donation', 'to': 'rule:verified_only'})
    edges.append({'type': 'HAS_RULE', 'from': 'action:request_donation', 'to': 'rule:before_deadline'})
    edges.append({'type': 'HAS_RULE', 'from': 'action:request_donation', 'to': 'rule:has_storage'})
    for c in CATEGORIES:
        edges.append({'type': 'CHECKED_BY', 'from': f'category:{c}', 'to': 'rule:accepts_category'})
    for s in STORAGE_LABEL:
        edges.append({'type': 'CHECKED_BY', 'from': f'storage:{s}', 'to': 'rule:has_storage'})

    # aliases used to find entities in questions and chunks
    alias = {n['id']: sorted({n['label'].lower(), n['key'].lower().replace('_', ' ')} | set(ALIASES.get(n['id'], [])))
             for n in nodes}
    for n in nodes:
        n['aliases'] = alias[n['id']]

    # MENTIONS: knowledge-base chunk -> entity
    chunks = []
    if DB_PATH.exists():
        con = sqlite3.connect(DB_PATH)
        chunks = con.execute('SELECT id, doc, section, text FROM chunks').fetchall()
        con.close()
    for cid, doc, section, text in chunks:
        low = f' {section} {text} '.lower()
        for n in nodes:
            if n['kind'] in ('role', 'action', 'status', 'category', 'storage', 'org_type', 'rule') and \
                    any(re.search(rf'(?<![a-z]){re.escape(a)}(?![a-z])', low) for a in n['aliases'] if len(a) > 3):
                edges.append({'type': 'MENTIONS', 'from': f'chunk:{cid}', 'to': n['id']})
    return {'nodes': nodes, 'edges': edges, 'chunks': [{'id': f'chunk:{c[0]}', 'doc': c[1], 'section': c[2]} for c in chunks]}


def write_kuzu(g: dict) -> None:
    if GRAPH_DB.exists():
        shutil.rmtree(GRAPH_DB) if GRAPH_DB.is_dir() else GRAPH_DB.unlink()
    GRAPH_DB.parent.mkdir(parents=True, exist_ok=True)
    db = kuzu.Database(str(GRAPH_DB))
    con = kuzu.Connection(db)
    con.execute('CREATE NODE TABLE Entity(id STRING, kind STRING, key STRING, label STRING, description STRING, '
                'terminal BOOLEAN, aliases STRING[], PRIMARY KEY(id))')
    con.execute('CREATE NODE TABLE Chunk(id STRING, doc STRING, section STRING, PRIMARY KEY(id))')
    for t in ('CAN_PERFORM', 'REQUIRES_STATUS', 'RESULTS_IN', 'NEXT_STATUS', 'IS_ROLE', 'HAS_RULE', 'CHECKED_BY'):
        con.execute(f'CREATE REL TABLE {t}(FROM Entity TO Entity)')
    con.execute('CREATE REL TABLE MENTIONS(FROM Chunk TO Entity)')
    for n in g['nodes']:
        con.execute('CREATE (:Entity {id: $id, kind: $kind, key: $key, label: $label, description: $d, terminal: $t, aliases: $a})',
                    {'id': n['id'], 'kind': n['kind'], 'key': n['key'], 'label': n['label'], 'd': n.get('description', ''),
                     't': bool(n.get('terminal', False)), 'a': n['aliases']})
    for c in g['chunks']:
        con.execute('CREATE (:Chunk {id: $id, doc: $doc, section: $s})', {'id': c['id'], 'doc': c['doc'], 's': c['section']})
    for e in g['edges']:
        src = 'Chunk' if e['type'] == 'MENTIONS' else 'Entity'
        con.execute(f'MATCH (a:{src} {{id: $f}}), (b:Entity {{id: $t}}) CREATE (a)-[:{e["type"]}]->(b)', {'f': e['from'], 't': e['to']})
    con.close()
    db.close()


def main() -> None:
    g = build()
    write_kuzu(g)
    # Export from Kùzu itself, so the live site uses exactly what the graph database holds.
    con = kuzu.Connection(kuzu.Database(str(GRAPH_DB), read_only=True))
    nodes = con.execute('MATCH (n:Entity) RETURN n.id, n.kind, n.key, n.label, n.description, n.terminal, n.aliases ORDER BY n.id').get_as_df()
    rels = con.execute('MATCH (a:Entity)-[r]->(b:Entity) RETURN label(r) AS type, a.id AS src, b.id AS dst ORDER BY type, src, dst').get_as_df()
    mentions = con.execute('MATCH (c:Chunk)-[:MENTIONS]->(e:Entity) RETURN c.id, e.id ORDER BY c.id, e.id').get_as_df()
    GRAPH_JSON.write_text(json.dumps({
        'nodes': [{'id': r[0], 'kind': r[1], 'key': r[2], 'label': r[3], 'description': r[4] or '', 'terminal': bool(r[5]),
                   'aliases': list(r[6])} for r in nodes.itertuples(index=False)],
        'edges': [{'type': r[0], 'from': r[1], 'to': r[2]} for r in rels.itertuples(index=False)],
        'mentions': [[r[0], r[1]] for r in mentions.itertuples(index=False)],
    }, ensure_ascii=False, separators=(',', ':')))
    print(f'[graph] data/graph.kuzu: {len(nodes)} entities, {len(rels)} relationships, {len(mentions)} chunk mentions')
    print(f'[graph] lib/rag/graph.json for the live site: {GRAPH_JSON.stat().st_size / 1024:.0f} KB')
    con.close()
    from ingest import write_golden
    write_golden()   # TypeScript parity cases, now that the graph exists


if __name__ == '__main__':
    main()
