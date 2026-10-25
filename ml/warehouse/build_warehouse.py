"""
FoodSphere AI data warehouse (DuckDB).

Builds a star schema for waste and food-rescue analytics, then runs the analytics queries and
saves each result as a CSV report.

Sources
  1. ml/waste/data/raw/food_waste_dataset.csv                    Kaggle, real data      -> fact_inventory_waste
  2. ml/matching/data/synthetic_donation_matching_dataset.csv    synthetic, labelled    -> fact_donation_match
  3. data/foodsphere-v2.db (the app's SQLite database, optional)  live app data          -> fact_app_donation

Output
  data/foodsphere_warehouse.duckdb       the warehouse (rebuilt from scratch on every run)
  ml/warehouse/reports/*.csv             one CSV per query in analytics.sql
  ml/warehouse/reports/summary.json      row counts, data-quality fixes and headline numbers

Run from the project root:
  pip install -r ml/warehouse/requirements.txt
  npm run warehouse            (same as: python3 ml/warehouse/build_warehouse.py)
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sqlite3
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

import duckdb
import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
WASTE_CSV = ROOT / 'ml/waste/data/raw/food_waste_dataset.csv'
MATCH_CSV = ROOT / 'ml/matching/data/synthetic_donation_matching_dataset.csv'

PERISHABLE = {'Dairy', 'Meat', 'Seafood', 'Prepared Food', 'Bakery', 'Fruits', 'Vegetables'}
YES = {'yes', 'y', 'true', '1'}
NO = {'no', 'n', 'false', '0'}


# ---------- cleaning helpers ----------

def title(s: pd.Series) -> pd.Series:
    """'  community kitchen ' -> 'Community Kitchen'; keeps missing values missing."""
    return s.astype('string').str.strip().str.replace(r'\s+', ' ', regex=True).str.title()


def yes_no(s: pd.Series) -> pd.Series:
    v = s.astype('string').str.strip().str.lower()
    out = pd.Series(pd.NA, index=s.index, dtype='boolean')
    out[v.isin(YES)] = True
    out[v.isin(NO)] = False
    return out


def date_key(d: pd.Series) -> pd.Series:
    return pd.to_datetime(d).dt.strftime('%Y%m%d').astype(int)


def key_map(values) -> dict:
    """Stable surrogate keys: sorted values numbered from 1."""
    return {v: i for i, v in enumerate(sorted({x for x in values if pd.notna(x)}), start=1)}


# ---------- extract + transform ----------

def load_waste(fixes: dict) -> pd.DataFrame:
    df = pd.read_csv(WASTE_CSV)
    for c in ['Business_Type', 'Food_Category', 'Weather', 'Waste_Reason', 'Waste_Level']:
        df[c] = title(df[c])
    before = len(df)
    df = df.drop_duplicates('Inventory_ID')
    fixes['waste_duplicate_ids_removed'] = before - len(df)
    fixes['waste_missing_weather_set_unknown'] = int(df['Weather'].isna().sum())
    df['Weather'] = df['Weather'].fillna('Unknown')
    df['Promotion'] = yes_no(df['Promotion']).fillna(False)
    fixes['waste_missing_donation_flag_set_false'] = int(df['Donation_Made'].isna().sum())
    df['Donation_Made'] = yes_no(df['Donation_Made']).fillna(False)
    df['Date'] = pd.to_datetime(df['Date'])
    return df


def load_matches(fixes: dict) -> pd.DataFrame:
    """Uses the same cleaning as the matching model (ml/matching/pipeline.py), so both see identical data."""
    sys.path.insert(0, str(ROOT / 'ml/matching'))
    from pipeline import clean, load_raw  # noqa: E402

    df, rep = clean(load_raw(str(MATCH_CSV)))
    fixes['match_cleaning_report'] = {k: int(v) for k, v in rep.items()}
    for c in ['Org_Name', 'Donor_Area', 'Org_Area']:
        df[c] = df[c].str.strip().str.replace(r'\s+', ' ', regex=True)
    # The same organization always has the same type and area: fill gaps from its other rows.
    missing = int(df['Org_Type'].isna().sum())
    for c in ['Org_Type', 'Org_Area', 'Org_Name']:
        df[c] = df.groupby('Org_ID')[c].transform(lambda s: s.fillna(s.mode().iat[0]) if not s.mode().empty else s)
    df['Org_Type'] = df['Org_Type'].fillna('Unknown')
    fixes['match_missing_org_type_filled'] = missing - int((df['Org_Type'] == 'Unknown').sum())
    for c in ['Accepts_Category', 'Has_Required_Storage', 'Accepted', 'Successful_Match']:
        df[c] = df[c].map({1: True, 0: False}).astype('boolean')
    df['Successful_Match'] = df['Successful_Match'].fillna(False)
    df['Delivered_Quantity'] = df['Delivered_Quantity'].fillna(0)
    return df


def load_app(app_db: Path) -> pd.DataFrame | None:
    """Read donations from the app's SQLite file without touching it (works on a temporary copy)."""
    if not app_db.exists():
        return None
    with tempfile.TemporaryDirectory() as tmp:
        for f in app_db.parent.glob(app_db.name + '*'):  # the .db plus its -wal / -shm files
            shutil.copy2(f, Path(tmp) / f.name)
        con = sqlite3.connect(Path(tmp) / app_db.name)
        df = pd.read_sql_query("""
            SELECT d.id                     AS donation_id,
                   substr(d.available_from, 1, 10) AS date,
                   d.food_category,
                   COALESCE(d.area, dorg.area) AS donor_area,
                   d.quantity_available,
                   d.unit,
                   d.status                 AS donation_status,
                   c.quantity_delivered,
                   c.status                 AS collection_status,
                   rorg.user_id             AS recipient_user_id,
                   rorg.organization_name   AS recipient_name,
                   rorg.organization_type   AS recipient_type,
                   rorg.area                AS recipient_area
            FROM donations d
            LEFT JOIN organizations dorg      ON dorg.user_id = d.donor_id
            LEFT JOIN collections c           ON c.donation_id = d.id
            LEFT JOIN donation_requests r     ON r.id = c.request_id
            LEFT JOIN organizations rorg      ON rorg.user_id = r.recipient_id
        """, con)
        con.close()
    df['food_category'] = title(df['food_category'])
    df['date'] = pd.to_datetime(df['date'])
    return df


# ---------- load ----------

def build(out: Path, app_db: Path, reports: Path) -> dict:
    t0 = time.time()
    fixes: dict = {}
    waste = load_waste(fixes)
    match = load_matches(fixes)
    app = load_app(app_db)

    out.parent.mkdir(parents=True, exist_ok=True)
    for f in (out, out.with_suffix(out.suffix + '.wal')):
        f.unlink(missing_ok=True)
    con = duckdb.connect(str(out))
    con.execute((HERE / 'schema.sql').read_text())

    # Dimensions
    dates = pd.concat([waste['Date'], match['Date']] + ([app['date']] if app is not None else [])).dropna().unique()
    d = pd.DataFrame({'full_date': pd.to_datetime(sorted(dates))})
    dim_date = pd.DataFrame({
        'date_key': d['full_date'].dt.strftime('%Y%m%d').astype(int),
        'full_date': d['full_date'].dt.date,
        'year': d['full_date'].dt.year,
        'quarter': d['full_date'].dt.quarter,
        'month': d['full_date'].dt.month,
        'month_name': d['full_date'].dt.month_name(),
        'week_of_year': d['full_date'].dt.isocalendar().week.astype(int),
        'day_of_week': d['full_date'].dt.dayofweek + 1,
        'weekday_name': d['full_date'].dt.day_name(),
        'is_weekend': d['full_date'].dt.dayofweek >= 5,
    })

    cats = key_map(list(waste['Food_Category']) + list(match['Food_Category'])
                   + (list(app['food_category']) if app is not None else []))
    biz = key_map(list(waste['Business_Type']) + list(match['Business_Type']))
    weather = key_map(waste['Weather'])
    reasons = key_map(waste['Waste_Reason'])
    areas = key_map(list(match['Donor_Area']) + list(match['Org_Area'])
                    + (list(app['donor_area']) + list(app['recipient_area']) if app is not None else []))

    orgs = (match[['Org_ID', 'Org_Name', 'Org_Type', 'Org_Area']].drop_duplicates('Org_ID')
            .rename(columns={'Org_ID': 'source_org_id', 'Org_Name': 'org_name', 'Org_Type': 'org_type', 'Org_Area': 'area'}))
    orgs['data_source'] = 'synthetic'
    if app is not None:
        a = (app.dropna(subset=['recipient_user_id'])
             [['recipient_user_id', 'recipient_name', 'recipient_type', 'recipient_area']].drop_duplicates('recipient_user_id'))
        orgs = pd.concat([orgs, pd.DataFrame({
            'source_org_id': 'app-' + a['recipient_user_id'].astype(int).astype(str),
            'org_name': a['recipient_name'], 'org_type': a['recipient_type'], 'area': a['recipient_area'],
            'data_source': 'app'})], ignore_index=True)
    orgs = orgs.sort_values(['data_source', 'source_org_id']).reset_index(drop=True)
    orgs.insert(0, 'organization_key', orgs.index + 1)
    orgs['area_key'] = orgs['area'].map(areas)
    org_key = {(r.source_org_id, r.data_source): r.organization_key for r in orgs.itertuples()}

    dims = {
        'dim_date': dim_date,
        'dim_food_category': pd.DataFrame({'category_key': list(cats.values()), 'category_name': list(cats),
                                           'is_perishable': [c in PERISHABLE for c in cats]}),
        'dim_business_type': pd.DataFrame({'business_type_key': list(biz.values()), 'business_type_name': list(biz)}),
        'dim_weather': pd.DataFrame({'weather_key': list(weather.values()), 'weather_name': list(weather)}),
        'dim_waste_reason': pd.DataFrame({'waste_reason_key': list(reasons.values()), 'waste_reason_name': list(reasons)}),
        'dim_area': pd.DataFrame({'area_key': list(areas.values()), 'area_name': list(areas)}),
        'dim_organization': orgs[['organization_key', 'source_org_id', 'org_name', 'org_type', 'area_key', 'data_source']],
    }

    # Facts
    facts = {
        'fact_inventory_waste': pd.DataFrame({
            'inventory_id': waste['Inventory_ID'],
            'date_key': date_key(waste['Date']),
            'category_key': waste['Food_Category'].map(cats),
            'business_type_key': waste['Business_Type'].map(biz),
            'weather_key': waste['Weather'].map(weather),
            'waste_reason_key': waste['Waste_Reason'].map(reasons),
            'purchase_quantity': waste['Purchase_Quantity'],
            'units_sold': waste['Units_Sold'],
            'remaining_stock': waste['Remaining_Stock'],
            'waste_quantity': waste['Waste_Quantity'],
            'daily_demand': waste['Daily_Demand'],
            'shelf_life_days': waste['Shelf_Life_Days'],
            'storage_temp_c': waste['Storage_Temperature'],
            'promotion': waste['Promotion'].astype(bool),
            'donation_made': waste['Donation_Made'].astype(bool),
            'waste_level': waste['Waste_Level'],
        }),
        'fact_donation_match': pd.DataFrame({
            'match_id': match['Match_ID'],
            'donation_id': match['Donation_ID'],
            'date_key': date_key(match['Date']),
            'category_key': match['Food_Category'].map(cats),
            'business_type_key': match['Business_Type'].map(biz),
            'organization_key': [org_key[(o, 'synthetic')] for o in match['Org_ID']],
            'donor_area_key': match['Donor_Area'].map(areas),
            'quantity_units': match['Quantity_Units'],
            'hours_to_expiry': match['Hours_To_Expiry'],
            'distance_km': match['Distance_km'],
            'travel_time_min': match['Est_Travel_Time_min'],
            'accepts_category': match['Accepts_Category'],
            'has_required_storage': match['Has_Required_Storage'],
            'accepted': match['Accepted'],
            'delivered_quantity': match['Delivered_Quantity'],
            'failure_reason': match['Failure_Reason'],
            'successful_match': match['Successful_Match'].astype(bool),
            'data_source': 'synthetic',
        }),
    }
    if app is not None:
        facts['fact_app_donation'] = pd.DataFrame({
            'donation_id': app['donation_id'],
            'date_key': date_key(app['date']),
            'category_key': app['food_category'].map(cats),
            'donor_area_key': app['donor_area'].map(areas),
            'organization_key': [org_key.get((f'app-{int(u)}', 'app')) if pd.notna(u) else None
                                 for u in app['recipient_user_id']],
            'quantity_available': app['quantity_available'],
            'unit': app['unit'],
            'donation_status': app['donation_status'],
            'quantity_delivered': app['quantity_delivered'],
            'collection_status': app['collection_status'],
            'data_source': 'app',
        })

    # Insert in dependency order; DuckDB enforces the primary and foreign keys from schema.sql.
    for name, frame in {**dims, **facts}.items():
        con.register('src', frame)
        cols = ', '.join(frame.columns)
        con.execute(f'INSERT INTO {name} ({cols}) SELECT {cols} FROM src')
        con.unregister('src')

    # Analytics -> CSV reports
    reports.mkdir(parents=True, exist_ok=True)
    report_rows = {}
    for block in re.split(r'^-- name: ', (HERE / 'analytics.sql').read_text(), flags=re.M)[1:]:
        name, sql = block.split('\n', 1)
        df = con.execute(sql).df()
        df.to_csv(reports / f'{name.strip()}.csv', index=False)
        report_rows[name.strip()] = len(df)

    q = lambda s: con.execute(s).fetchone()  # noqa: E731
    total_bought, total_wasted = q('SELECT SUM(purchase_quantity), SUM(waste_quantity) FROM fact_inventory_waste')
    worst = q("""SELECT c.category_name, ROUND(100.0*SUM(waste_quantity)/SUM(purchase_quantity),2)
                 FROM fact_inventory_waste f JOIN dim_food_category c USING (category_key)
                 GROUP BY 1 ORDER BY 2 DESC LIMIT 1""")
    success, delivered = q('SELECT ROUND(100.0*AVG(successful_match::INT),1), SUM(delivered_quantity) FROM fact_donation_match')
    near = q("SELECT ROUND(100.0*AVG(successful_match::INT),1) FROM fact_donation_match WHERE distance_km < 2")
    far = q("SELECT ROUND(100.0*AVG(successful_match::INT),1) FROM fact_donation_match WHERE distance_km >= 10")
    tables = [r[0] for r in con.execute(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='main' ORDER BY 1").fetchall()]
    summary = {
        'built_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'warehouse_file': str(out.relative_to(ROOT)) if out.is_relative_to(ROOT) else str(out),
        'duckdb_version': duckdb.__version__,
        'app_database_loaded': app is not None,
        'row_counts': {t: q(f'SELECT COUNT(*) FROM {t}')[0] for t in tables},
        'data_quality_fixes': fixes,
        'reports': report_rows,
        'headline': {
            'kaggle_waste_rate_pct': round(100 * total_wasted / total_bought, 2),
            'highest_waste_category': {'category': worst[0], 'waste_rate_pct': worst[1]},
            'synthetic_match_success_rate_pct': success,
            'synthetic_units_delivered': int(delivered),
            'success_rate_under_2km_pct': near[0],
            'success_rate_10km_plus_pct': far[0],
        },
        'build_seconds': round(time.time() - t0, 2),
    }
    (reports / 'summary.json').write_text(json.dumps(summary, indent=2, default=str))
    con.close()
    return summary


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--out', type=Path, default=ROOT / 'data/foodsphere_warehouse.duckdb')
    p.add_argument('--app-db', type=Path, default=ROOT / 'data/foodsphere-v2.db')
    p.add_argument('--reports', type=Path, default=HERE / 'reports')
    a = p.parse_args()
    s = build(a.out.resolve(), a.app_db.resolve(), a.reports.resolve())
    print(f"[warehouse] built {s['warehouse_file']} in {s['build_seconds']}s")
    for t, n in s['row_counts'].items():
        print(f'  {t:<24} {n:>6} rows')
    print(f"  app database loaded: {s['app_database_loaded']}")
    print(f"[warehouse] {len(s['reports'])} reports written to ml/warehouse/reports/")
    h = s['headline']
    print(f"  waste rate {h['kaggle_waste_rate_pct']}% | worst category {h['highest_waste_category']['category']} "
          f"| match success {h['synthetic_match_success_rate_pct']}% "
          f"({h['success_rate_under_2km_pct']}% under 2 km vs {h['success_rate_10km_plus_pct']}% at 10+ km)")


if __name__ == '__main__':
    main()
