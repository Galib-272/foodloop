"""
Builds the knowledge base for "Ask FoodSphere" (rag/knowledge/*.md) from the project's own content,
so the assistant always answers from the same text the app shows:

  app/<info page>/page.tsx     About, Guidelines, Food Safety, Privacy, Data Use, Terms, Help Center
  components/landing/...       FAQ answers
  app/app/help/page.tsx        Getting-started guide for each role
  README.md                    workflow, matching rules, ML and deployment sections
  ml/*/reports/metrics_*.json  AI model results
  ml/warehouse/reports/        data-warehouse findings

Run: python3 rag/build_knowledge.py
"""
from __future__ import annotations

import ast
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'rag/knowledge'

INFO_PAGES = ['about', 'guidelines', 'food-safety', 'privacy', 'data-use', 'terms', 'help']


def unescape(s: str) -> str:
    return json.loads(f'"{s}"') if '\\u' in s else s


def info_page(name: str) -> str:
    src = (ROOT / f'app/{name}/page.tsx').read_text()
    attr = lambda a: unescape(re.search(rf'{a}="((?:[^"\\]|\\.)*)"', src).group(1))  # noqa: E731
    sections = json.loads(re.search(r'const sections = (\[.*?\n\]);', src, re.S).group(1))
    md = [f'# {attr("title")}', '', attr('intro'), '']
    for s in sections:
        md += [f'## {s["heading"]}', '']
        for part in s['body']:
            if isinstance(part, list):
                md += [f'- {x}' for x in part] + ['']
            else:
                md += [part, '']
    return '\n'.join(md)


def ts_string_lists(src: str, start: str) -> str:
    """Return the bracketed literal that follows `start` (balanced brackets)."""
    i = src.index(start) + len(start)
    i = min(k for k in (src.find('[', i), src.find('{', i)) if k >= 0)
    depth, j = 0, i
    for j in range(i, len(src)):
        depth += src[j] in '[{'
        depth -= src[j] in ']}'
        if depth == 0:
            break
    return src[i:j + 1]


def py_literal(ts: str):
    # TS string/array/object literals of plain strings are valid Python once unquoted keys are quoted.
    ts = re.sub(r'(\w+):\s*\[', r'"\1": [', ts)
    return ast.literal_eval(ts)


def faq_and_guides() -> str:
    faqs = py_literal(ts_string_lists((ROOT / 'components/landing/sections.tsx').read_text(), 'export const FAQS = '))
    guides = py_literal(ts_string_lists((ROOT / 'app/app/help/page.tsx').read_text(), 'const GUIDES: Record<string, string[]> = '))
    md = ['# Frequently asked questions and getting-started guides', '']
    for q, a in faqs:
        md += [f'## {q}', '', a, '']
    names = {'donor': 'Donors (restaurants, shops, event organizers)', 'recipient': 'Recipient organizations (NGOs, kitchens, shelters, food banks)',
             'volunteer': 'Volunteers', 'admin': 'Administrators'}
    for role, steps in guides.items():
        md += [f'## Getting started for {names[role]}', ''] + [f'{i}. {s}' for i, s in enumerate(steps, 1)] + ['']
    return '\n'.join(md)


def readme() -> str:
    text = (ROOT / 'README.md').read_text()
    keep = ['Architecture', 'Machine learning', 'Data warehouse (DuckDB)', 'Deploy (Vercel + Turso)']
    parts = re.split(r'^## ', text, flags=re.M)
    md = ['# FoodSphere AI platform and technology (from the README)', '']
    for p in parts[1:]:
        title = p.split('\n', 1)[0].strip()
        if title in keep:
            body = p.split('\n', 1)[1]
            body = re.sub(r'```.*?```', '', body, flags=re.S)  # drop shell snippets
            body = body.replace('### ', '### ').strip()
            md += [f'## {title}', '', body, '']
    return '\n'.join(md)


def model_results() -> str:
    w = json.loads((ROOT / 'ml/waste/reports/metrics_summary.json').read_text())
    m = json.loads((ROOT / 'ml/matching/reports/metrics_summary.json').read_text())
    r, c, t = w['leftover_regression'], w['waste_level_classification'], m['test']
    rank = m['ranking_top_pick']
    return f"""# AI model results

FoodSphere AI uses two machine-learning models. Both are trained offline in Python notebooks, exported to JSON and run inside the web app in TypeScript.

## AI model 1: leftover amount (regression)

Trained on the real Kaggle food waste dataset (8,000 daily inventory records). The selected model is {w['selected']['leftover']}.
Test mean absolute error is {r['MAE']} units (root mean squared error {r['RMSE']}), and R squared is {r['R2']}.
A simple average baseline has an error of {r['baseline_mean_MAE']} units, so the model is about three times better.
The 80% prediction range covers {round(r['interval_80_coverage'] * 100, 1)}% of test days, and {round(r['within_10_units'] * 100, 1)}% of predictions are within 10 units.

## AI model 1: waste risk Low, Medium or High (classification)

The selected model is {w['selected']['waste_level']}. Test accuracy is {round(c['accuracy'] * 100, 1)}% against a baseline of {round(c['baseline_accuracy'] * 100, 1)}% (always guessing Low).
Macro precision is {c['precision_macro']}, macro recall {c['recall_macro']}, macro F1 {c['f1_macro']} and ROC-AUC {c['roc_auc_ovr_macro']}.
Accuracy is limited because the waste level depends on how many customers actually come that day, which is unknown in the morning.

## AI model 2: recipient matching (classification)

Trained on a clearly labelled synthetic dataset of donation offers to organizations. The selected model is {m['selected']}.
It predicts whether an offer to an organization will end in a successful delivery.
Test accuracy is {round(t['accuracy'] * 100, 1)}% (baseline {round(t['baseline_accuracy'] * 100, 1)}%), precision {t['precision']}, recall {t['recall']}, F1 {t['f1']} and ROC-AUC {t['roc_auc']}.

## How the matching ranking compares

When the top-ranked organization is chosen, the share of successful deliveries is:
""" + '\n'.join(f'- {k}: {round(v * 100, 1)}%' for k, v in rank.items()) + """

Because the matching data is synthetic, these numbers show that the pipeline works; they are not real-world evidence.
"""


def warehouse() -> str:
    rep = ROOT / 'ml/warehouse/reports'
    s = json.loads((rep / 'summary.json').read_text())
    h = s['headline']
    rows = lambda f: list(csv.DictReader(open(rep / f)))  # noqa: E731
    cat = rows('waste_by_category.csv')
    org = rows('match_success_by_org_type.csv')
    dist = rows('match_success_by_distance.csv')
    reasons = rows('waste_reasons.csv')
    day = rows('waste_by_weekday.csv')
    md = ['# Data warehouse findings (DuckDB)', '',
          'The DuckDB data warehouse combines the Kaggle food waste data, the synthetic matching data and the app database into a star schema '
          'with fact tables (inventory waste, donation matches, app donations) and dimension tables (date, food category, business type, weather, '
          'waste reason, area, organization).', '',
          '## Food waste by category', '',
          f'The overall waste rate in the Kaggle data is {h["kaggle_waste_rate_pct"]}% of units purchased. '
          f'{h["highest_waste_category"]["category"]} wastes the most at {h["highest_waste_category"]["waste_rate_pct"]}%.', '']
    md += [f'- {r["food_category"]}: {r["waste_rate_pct"]}% waste rate, {int(float(r["units_wasted"]))} units wasted, high-risk days {r["high_risk_days_pct"]}%' for r in cat]
    md += ['', '## Why food is wasted', '']
    md += [f'- {r["waste_reason"]}: {r["share_of_waste_pct"]}% of wasted units' for r in reasons]
    worst = max(day, key=lambda r: float(r['waste_rate_pct']))
    best = min(day, key=lambda r: float(r['waste_rate_pct']))
    md += ['', '## Waste by day of the week', '',
           f'{worst["weekday_name"]} has the highest waste rate ({worst["waste_rate_pct"]}%) and {best["weekday_name"]} the lowest ({best["waste_rate_pct"]}%).', '',
           '## Which organizations complete donations (synthetic data)', '']
    md += [f'- {r["org_type"]}: {r["success_rate_pct"]}% of offers end in delivery, {int(float(r["units_delivered"]))} units delivered' for r in org]
    md += ['', '## Distance and pickup success (synthetic data)', '']
    md += [f'- {r["distance_band"]}: {r["success_rate_pct"]}% success, average travel {r["avg_travel_min"]} minutes' for r in dist]
    md += ['', 'Shorter distances make successful pickups more likely, which is why distance is a key input to the matching model.', '']
    return '\n'.join(md)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    docs = {f'page_{p.replace("-", "_")}': info_page(p) for p in INFO_PAGES}
    docs['faq_and_guides'] = faq_and_guides()
    docs['platform_readme'] = readme()
    docs['ai_model_results'] = model_results()
    docs['warehouse_findings'] = warehouse()
    for old in OUT.glob('*.md'):
        old.unlink()
    for name, text in docs.items():
        (OUT / f'{name}.md').write_text(text.strip() + '\n')
    print(f'[knowledge] wrote {len(docs)} documents to rag/knowledge/ '
          f'({sum(len(t) for t in docs.values()):,} characters)')


if __name__ == '__main__':
    main()
