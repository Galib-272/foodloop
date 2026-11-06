"""
Read-only SQL query on the FoodLoop DuckDB warehouse (data/foodsphere_warehouse.duckdb). Used by foodloop-warehouse-mcp.
Usage: python3 ml/warehouse/query.py '{"sql": "SELECT category_name FROM dim_food_category"}'
Only a single SELECT / WITH statement is allowed; the database is opened read-only and results are capped at 200 rows.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

DB = Path(__file__).resolve().parents[2] / 'data/foodsphere_warehouse.duckdb'
MAX_ROWS = 200


def main() -> None:
    try:
        sql = json.loads(sys.argv[1])['sql'].strip().rstrip(';').strip()
        if ';' in sql or not re.match(r'^(SELECT|WITH)\b', sql, re.I):
            raise ValueError('Only a single read-only SELECT (or WITH ... SELECT) statement is allowed.')
        if not DB.exists():
            raise ValueError('Warehouse not built yet. Run: npm run warehouse')
        import duckdb
        con = duckdb.connect(str(DB), read_only=True)
        cur = con.execute(f'SELECT * FROM ({sql}) AS q LIMIT {MAX_ROWS + 1}')
        cols = [d[0] for d in cur.description]
        rows = cur.fetchall()
        print(json.dumps({'ok': True, 'columns': cols, 'rows': rows[:MAX_ROWS], 'truncated': len(rows) > MAX_ROWS}, default=str))
    except Exception as e:  # noqa: BLE001
        print(json.dumps({'ok': False, 'error': f'{type(e).__name__}: {e}'}))


if __name__ == '__main__':
    main()
