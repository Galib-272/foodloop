"""
Read-only Cypher query on the FoodLoop knowledge graph (data/graph.kuzu). Used by the foodloop-knowledge-mcp server.
Usage: python3 rag/graph_query.py '{"cypher": "MATCH (r:Entity {kind: \\"role\\"}) RETURN r.label"}'
Prints one JSON line: {"ok": true, "columns": [...], "rows": [...]} or {"ok": false, "error": "..."}.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

GRAPH_DB = Path(__file__).resolve().parents[1] / 'data/graph.kuzu'
WRITE = re.compile(r'\b(CREATE|MERGE|DELETE|DETACH|SET|REMOVE|DROP|ALTER|COPY|INSTALL|LOAD|ATTACH|EXPORT|IMPORT|CALL|BEGIN|COMMIT)\b', re.I)
MAX_ROWS = 200


def main() -> None:
    try:
        cypher = json.loads(sys.argv[1])['cypher'].strip().rstrip(';')
        if not cypher or ';' in cypher or WRITE.search(cypher):
            raise ValueError('Only a single read-only MATCH ... RETURN query is allowed.')
        if not GRAPH_DB.exists():
            raise ValueError('data/graph.kuzu not found. Run: npm run rag:ingest')
        import kuzu
        con = kuzu.Connection(kuzu.Database(str(GRAPH_DB), read_only=True))
        res = con.execute(cypher)
        cols = res.get_column_names()
        rows = []
        while res.has_next() and len(rows) < MAX_ROWS:
            rows.append([v if isinstance(v, (str, int, float, bool, type(None), list)) else str(v) for v in res.get_next()])
        print(json.dumps({'ok': True, 'columns': cols, 'rows': rows, 'truncated': res.has_next()}, default=str))
    except Exception as e:  # noqa: BLE001
        print(json.dumps({'ok': False, 'error': f'{type(e).__name__}: {e}'}))


if __name__ == '__main__':
    main()
