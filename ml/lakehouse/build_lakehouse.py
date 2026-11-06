"""
FoodLoop lakehouse on Delta Lake (deltalake / delta-rs, no Spark or cloud needed).

Medallion layers in data/lakehouse/:
  bronze/  raw data exactly as received, plus ingestion columns (_source, _ingested_at, _batch_id)
  silver/  cleaned, typed tables. The same cleaning as the DuckDB warehouse and the ML models.
           app_donations is updated with a Delta MERGE (upsert on donation_id), so re-runs only change what changed.
  gold/    analysis-ready tables (daily waste by category, match success by organization type, monthly rescue)

Every write is a new Delta table version (time travel), schemas are enforced on append, and the run writes
ml/lakehouse/reports/lakehouse_summary.json with row counts, versions and the operation history of every table.
Synthetic data stays labelled: its tables are named *_synthetic and carry data_source = 'synthetic'.

Run: npm run lakehouse        (python3 ml/lakehouse/build_lakehouse.py)
"""
from __future__ import annotations

import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import pyarrow as pa
from deltalake import DeltaTable, write_deltalake

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
LAKE = ROOT / 'data/lakehouse'
REPORTS = HERE / 'reports'
sys.path.insert(0, str(ROOT / 'ml/warehouse'))
from build_warehouse import MATCH_CSV, WASTE_CSV, load_app, load_matches, load_waste  # noqa: E402

BATCH = uuid.uuid4().hex[:12]
NOW = datetime.now(timezone.utc)


def path(layer: str, name: str) -> str:
    return str(LAKE / layer / name)


def with_ingest_cols(df: pd.DataFrame, source: str) -> pd.DataFrame:
    df = df.copy()
    df['_source'] = source
    df['_ingested_at'] = NOW
    df['_batch_id'] = BATCH
    return df


def bronze() -> None:
    """Raw files as strings: nothing is lost or reinterpreted, so silver can always be rebuilt."""
    for name, csv in [('food_waste_raw', WASTE_CSV), ('donation_matching_raw_synthetic', MATCH_CSV)]:
        raw = pd.read_csv(csv, dtype=str, keep_default_na=False)
        write_deltalake(path('bronze', name), with_ingest_cols(raw, str(csv.relative_to(ROOT))), mode='overwrite',
                        schema_mode='overwrite', description=f'Raw copy of {csv.name}')


def silver(fixes: dict, app_db: Path) -> dict:
    waste = load_waste(fixes)
    waste['year'] = waste['Date'].dt.year
    waste.columns = [c.lower() for c in waste.columns]
    write_deltalake(path('silver', 'inventory_waste'), with_ingest_cols(waste, 'bronze/food_waste_raw'), mode='overwrite',
                    schema_mode='overwrite', partition_by=['year'], description='Cleaned Kaggle inventory records (real data)')

    match = load_matches(fixes)
    match.columns = [c.lower() for c in match.columns]
    match['data_source'] = 'synthetic'
    for c in ('accepts_category', 'has_required_storage', 'accepted', 'successful_match'):
        match[c] = match[c].astype('boolean')
    write_deltalake(path('silver', 'donation_matches_synthetic'), with_ingest_cols(match, 'bronze/donation_matching_raw_synthetic'),
                    mode='overwrite', schema_mode='overwrite', description='Cleaned synthetic donation-matching offers (SYNTHETIC)')

    merge_stats = {}
    app = load_app(app_db)
    if app is not None:
        app = with_ingest_cols(app.assign(data_source='app'), str(app_db.relative_to(ROOT)) if app_db.is_relative_to(ROOT) else str(app_db))
        app['quantity_delivered'] = app['quantity_delivered'].astype('float64')
        app['recipient_user_id'] = app['recipient_user_id'].astype('Int64')
        target = path('silver', 'app_donations')
        if DeltaTable.is_deltatable(target):
            # Delta MERGE: update changed donations, insert new ones (incremental load).
            src = pa.Table.from_pandas(app, preserve_index=False)
            dt = DeltaTable(target)
            res = (dt.merge(src, predicate='t.donation_id = s.donation_id', source_alias='s', target_alias='t')
                   .when_matched_update_all().when_not_matched_insert_all().execute())
            merge_stats = {k: res.get(k) for k in ('num_target_rows_updated', 'num_target_rows_inserted', 'num_source_rows')}
        else:
            write_deltalake(target, app, mode='overwrite', description='Donations from the FoodLoop app database')
            merge_stats = {'created': len(app)}
    return merge_stats


def gold() -> None:
    w = DeltaTable(path('silver', 'inventory_waste')).to_pandas()
    daily = (w.groupby([w['date'].dt.date.rename('date'), 'food_category'])
             .agg(units_purchased=('purchase_quantity', 'sum'), units_wasted=('waste_quantity', 'sum'), records=('inventory_id', 'count'))
             .reset_index())
    daily['date'] = pd.to_datetime(daily['date'])
    daily['waste_rate_pct'] = (100 * daily['units_wasted'] / daily['units_purchased']).round(2)
    write_deltalake(path('gold', 'daily_waste_by_category'), daily, mode='overwrite', schema_mode='overwrite',
                    description='Daily waste per food category (Kaggle)')

    m = DeltaTable(path('silver', 'donation_matches_synthetic')).to_pandas()
    org = (m.groupby('org_type').agg(offers=('match_id', 'count'), successes=('successful_match', 'sum'),
                                     units_delivered=('delivered_quantity', 'sum'), avg_distance_km=('distance_km', 'mean')).reset_index())
    org['success_rate_pct'] = (100 * org['successes'] / org['offers']).round(1)
    org['avg_distance_km'] = org['avg_distance_km'].round(2)
    org['data_source'] = 'synthetic'
    write_deltalake(path('gold', 'match_success_by_org_type_synthetic'), org, mode='overwrite', schema_mode='overwrite',
                    description='Delivery success by organization type (SYNTHETIC)')

    m['month'] = m['date'].dt.to_period('M').astype(str)
    monthly = (m.groupby('month').agg(units_delivered=('delivered_quantity', 'sum'), offers=('match_id', 'count'),
                                      successes=('successful_match', 'sum')).reset_index())
    monthly['data_source'] = 'synthetic'
    write_deltalake(path('gold', 'monthly_rescue_synthetic'), monthly, mode='overwrite', schema_mode='overwrite',
                    description='Units rescued per month (SYNTHETIC)')


def schema_check() -> str:
    """Delta enforces schemas: appending a row with a wrong column type must be rejected."""
    bad = pd.DataFrame({'date': ['not a date'], 'food_category': [1], 'units_wasted': ['x']})
    try:
        write_deltalake(path('gold', 'daily_waste_by_category'), bad, mode='append')
        return 'NOT ENFORCED'
    except Exception as e:  # noqa: BLE001
        return f'rejected as expected ({type(e).__name__})'


def summary(merge_stats: dict, fixes: dict, enforced: str) -> dict:
    tables = {}
    for layer in ('bronze', 'silver', 'gold'):
        for p in sorted((LAKE / layer).iterdir()):
            dt = DeltaTable(str(p))
            meta = dt.metadata()
            hist = dt.history(5)
            tables[f'{layer}/{p.name}'] = {
                'rows': sum(a.num_rows for a in dt.to_pyarrow_dataset().to_batches()) if layer != 'bronze' else dt.to_pyarrow_table().num_rows,
                'version': dt.version(),
                'files': len(dt.file_uris()),
                'partition_columns': meta.partition_columns,
                'columns': len(dt.schema().fields),
                'description': meta.description,
                'recent_operations': [h.get('operation') for h in hist],
            }
    return {'built_at': NOW.isoformat(timespec='seconds'), 'batch_id': BATCH, 'tables': tables,
            'app_donations_merge': merge_stats, 'schema_enforcement': enforced, 'data_quality_fixes': fixes}


def main() -> None:
    app_db = ROOT / 'data/foodsphere-v2.db'
    fixes: dict = {}
    bronze()
    merge_stats = silver(fixes, app_db)
    gold()
    enforced = schema_check()
    s = summary(merge_stats, fixes, enforced)
    REPORTS.mkdir(parents=True, exist_ok=True)
    (REPORTS / 'lakehouse_summary.json').write_text(json.dumps(s, indent=2, default=str) + '\n')
    print(f'[lakehouse] data/lakehouse (Delta Lake), batch {BATCH}')
    for name, t in s['tables'].items():
        part = f", partitioned by {', '.join(t['partition_columns'])}" if t['partition_columns'] else ''
        print(f'  {name:<45} {t["rows"]:>6} rows  v{t["version"]}  {t["files"]} file(s){part}')
    if merge_stats:
        print(f'  app_donations merge: {merge_stats}')
    print(f'  schema enforcement: {enforced}')


if __name__ == '__main__':
    main()
