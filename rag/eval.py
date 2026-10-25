"""
Evaluate "Ask FoodSphere".

Part 1, retrieval (always runs): for each test question with a known source, is the right section found?
  Compares naive vs contextual chunks and vector vs keyword (FTS5/BM25) vs hybrid search.
  Metrics: hit@1, hit@3 and MRR (mean reciprocal rank).

Part 2, local models (runs the models that Ollama has): every question goes through the LangGraph agent
  with each model. Metrics: answer contains the expected fact, cites a source, correctly refuses
  out-of-scope questions, latency and tokens per second.

Writes rag/reports/eval_results.json and rag/reports/eval_report.md.
Run: python3 rag/eval.py [--models qwen2.5:1.5b llama3.2:1b deepseek-r1:1.5b mistral:7b] [--retrieval-only]
"""
from __future__ import annotations

import argparse
import json
import platform
import statistics
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import LOCAL_MODELS, REPORTS, ROOT, Ollama  # noqa: E402
from retrieve import Retriever  # noqa: E402

QUESTIONS = json.loads((ROOT / 'rag/eval_questions.json').read_text())
CONFIGS = [('naive', 'vector', False), ('naive', 'keyword', False), ('naive', 'hybrid', False),
           ('contextual', 'vector', True), ('contextual', 'keyword', True), ('contextual', 'hybrid', True)]


def is_gold(hit, q) -> bool:
    return any(hit['doc'] == doc and sec.lower() in hit['section'].lower() for doc, sec in q['gold'])


def eval_retrieval(r: Retriever) -> list:
    rows = []
    answerable = [q for q in QUESTIONS if q['gold']]
    for chunks, mode, ctx in CONFIGS:
        h1 = h3 = mrr = 0.0
        misses = []
        for q in answerable:
            hits = r.search(q['q'], mode=mode, contextual=ctx, k=10)
            rank = next((i for i, h in enumerate(hits, 1) if is_gold(h, q)), None)
            h1 += rank == 1
            h3 += bool(rank and rank <= 3)
            mrr += 1 / rank if rank else 0
            if not rank or rank > 3:
                misses.append(q['q'])
        n = len(answerable)
        rows.append({'chunks': chunks, 'search': mode, 'hit@1': round(h1 / n, 3), 'hit@3': round(h3 / n, 3), 'mrr': round(mrr / n, 3),
                     'missed_top3': misses})
    return rows


def eval_models(r: Retriever, models: list) -> list:
    from agent import ask, build_graph
    graph = build_graph(r)
    out = []
    for model in models:
        print(f'[eval] {model}', flush=True)
        ask(graph, 'What is FoodSphere AI?', model)  # warm-up: loads the model into memory
        rows = []
        for q in QUESTIONS:
            res = ask(graph, q['q'], model)
            ans = res['answer'].lower()
            in_scope = bool(q['gold'])
            correct = all(e in ans for e in q['expect']) if in_scope else res['generator'] == 'refusal' or "don't know" in ans
            rows.append({'question': q['q'], 'in_scope': in_scope, 'answer': res['answer'], 'generator': res['generator'],
                         'correct': bool(correct), 'cited': bool(res.get('citations')), 'seconds': res['seconds'],
                         'tokens_per_second': (res.get('llm') or {}).get('tokens_per_second'),
                         'reasoning_chars': len((res.get('llm') or {}).get('thinking', ''))})
            print(f"   {'ok ' if correct else 'MISS'} {res['seconds']:>5}s  {q['q'][:60]}", flush=True)
        ins = [x for x in rows if x['in_scope']]
        outs = [x for x in rows if not x['in_scope']]
        llm_rows = [x for x in rows if x['generator'] == model]
        tps = [x['tokens_per_second'] for x in llm_rows if x['tokens_per_second']]
        out.append({'model': model,
                    'answer_accuracy': round(sum(x['correct'] for x in ins) / len(ins), 3),
                    'citation_rate': round(sum(x['cited'] for x in ins) / len(ins), 3),
                    'refusal_accuracy': round(sum(x['correct'] for x in outs) / len(outs), 3) if outs else None,
                    'median_seconds': statistics.median(x['seconds'] for x in llm_rows) if llm_rows else None,
                    'median_tokens_per_second': statistics.median(tps) if tps else None,
                    'answers': rows})
    return out


def write_report(result: dict) -> None:
    REPORTS.mkdir(parents=True, exist_ok=True)
    (REPORTS / 'eval_results.json').write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
    m = result['index']
    md = ['# Ask FoodSphere: RAG evaluation', '',
          f"Run {result['run_at']} on {result['machine']}. Index: {m['chunks']} chunks, embeddings `{m['embedding']}`, "
          f"vector store `{m['vector_backend']}`, keyword search SQLite FTS5 (BM25), chunk contexts: {m['contexts']}.", '',
          f"## Retrieval ({result['answerable_questions']} questions with a known source section)", '',
          '| Chunks | Search | Hit@1 | Hit@3 | MRR |', '|---|---|---|---|---|']
    md += [f"| {x['chunks']} | {x['search']} | {x['hit@1']:.0%} | {x['hit@3']:.0%} | {x['mrr']:.3f} |" for x in result['retrieval']]
    if result['models']:
        md += ['', f"## Local models through the LangGraph agent ({len(QUESTIONS)} questions, {result['out_of_scope_questions']} out of scope)", '',
               '| Model | Answer accuracy | Cites sources | Refuses out-of-scope | Median time | Tokens/s |', '|---|---|---|---|---|---|']
        for x in result['models']:
            md.append(f"| {x['model']} | {x['answer_accuracy']:.0%} | {x['citation_rate']:.0%} | "
                      f"{'' if x['refusal_accuracy'] is None else format(x['refusal_accuracy'], '.0%')} | "
                      f"{x['median_seconds'] or ''}s | {x['median_tokens_per_second'] or ''} |")
    else:
        md += ['', '## Local models', '', 'Not run: no Ollama models were available. Install Ollama, pull the models and run `npm run rag:eval`.']
    if result.get('skipped_models'):
        md += ['', 'Not available in Ollama, so skipped: ' + ', '.join(result['skipped_models']) + '.']
    (REPORTS / 'eval_report.md').write_text('\n'.join(md) + '\n')


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--models', nargs='*', default=LOCAL_MODELS)
    ap.add_argument('--retrieval-only', action='store_true')
    a = ap.parse_args()
    r = Retriever()
    retrieval = eval_retrieval(r)
    for x in retrieval:
        print(f"[eval] retrieval {x['chunks']:<10} {x['search']:<7} hit@1 {x['hit@1']:.0%}  hit@3 {x['hit@3']:.0%}  MRR {x['mrr']:.3f}")
    ollama = Ollama()
    available = [] if a.retrieval_only else [m for m in a.models if ollama.has(m)]
    skipped = [] if a.retrieval_only else [m for m in a.models if m not in available]
    models = eval_models(r, available) if available else []
    result = {'run_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
              'machine': f'{platform.system()} {platform.machine()}, Python {platform.python_version()}',
              'index': {'chunks': int(r.meta['chunks']), 'embedding': r.meta['embedding'], 'vector_backend': r.meta['vector_backend'],
                        'contexts': json.loads(r.meta['contexts'])},
              'answerable_questions': sum(1 for q in QUESTIONS if q['gold']),
              'out_of_scope_questions': sum(1 for q in QUESTIONS if not q['gold']),
              'retrieval': retrieval, 'models': models, 'skipped_models': skipped}
    write_report(result)
    for x in models:
        print(f"[eval] {x['model']:<18} answers {x['answer_accuracy']:.0%}  cites {x['citation_rate']:.0%}  "
              f"refuses {x['refusal_accuracy']:.0%}  median {x['median_seconds']}s")
    if skipped:
        print('[eval] skipped (not in Ollama): ' + ', '.join(skipped) + '. Run: ollama pull <model>')
    print('[eval] report: rag/reports/eval_report.md')


if __name__ == '__main__':
    main()
