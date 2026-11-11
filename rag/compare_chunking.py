"""
Compare fixed-size chunking with semantic (variable) chunking on the same test questions.
Builds two temporary indexes and writes rag/reports/chunking_comparison.md.
Run: npm run rag:compare
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import REPORTS  # noqa: E402
from eval import eval_retrieval  # noqa: E402
from retrieve import Retriever  # noqa: E402

rows = []
with tempfile.TemporaryDirectory() as tmp:
    for mode in ('fixed', 'semantic'):
        db = Path(tmp) / f'{mode}.db'
        subprocess.run([sys.executable, str(Path(__file__).parent / 'ingest.py'), '--chunking', mode, '--db', str(db), '--no-export'],
                       check=True, stdout=subprocess.DEVNULL)
        r = Retriever(db)
        stats = json.loads(r.meta['chunking'])
        for x in eval_retrieval(r):
            rows.append({'chunking': mode, 'n_chunks': stats['chunks'], 'avg_chars': stats['avg_chars'],
                         'dupes': stats['duplicates_removed'], 'embedding': r.meta['embedding'], **x})
        r.con.close()

md = ['# Fixed vs semantic chunking', '',
      f"Embeddings: `{rows[0]['embedding']}`. Same test questions as `eval_report.md`.", '',
      '| Chunking | Chunks | Avg chars | Duplicates removed | Chunk text | Search | Hit@1 | Hit@3 | MRR |',
      '|---|---|---|---|---|---|---|---|---|']
md += [f"| {x['chunking']} | {x['n_chunks']} | {x['avg_chars']} | {x['dupes']} | {x['chunks']} | {x['search']} | "
       f"{x['hit@1']:.0%} | {x['hit@3']:.0%} | {x['mrr']:.3f} |" for x in rows]
REPORTS.mkdir(parents=True, exist_ok=True)
(REPORTS / 'chunking_comparison.md').write_text('\n'.join(md) + '\n')
for x in rows:
    print(f"[chunking] {x['chunking']:<8} {x['chunks']:<10} {x['search']:<7} hit@1 {x['hit@1']:.0%}  MRR {x['mrr']:.3f}")
