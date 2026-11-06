#!/usr/bin/env node
// Collects the headline numbers from every report into lib/docs/metrics.json for the public /docs page.
// The page never hard-codes a metric: re-run `npm run docs:metrics` after retraining or re-evaluating.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => { try { return JSON.parse(fs.readFileSync(path.join(root, p), 'utf8')); } catch { return null; } };
const w = read('ml/waste/reports/metrics_summary.json');
const m = read('ml/matching/reports/metrics_summary.json');
const rag = read('rag/reports/eval_results.json');
const wh = read('ml/warehouse/reports/summary.json');
const lake = read('ml/lakehouse/reports/lakehouse_summary.json');
const graph = read('lib/rag/graph.json');
const index = read('lib/rag/index.json');

const out = {
  generated_at: new Date().toISOString(),
  waste: w && {
    leftover_model: w.selected.leftover, waste_model: w.selected.waste_level,
    mae: w.leftover_regression.MAE, r2: w.leftover_regression.R2, baseline_mae: w.leftover_regression.baseline_mean_MAE,
    interval_80: w.leftover_regression.interval_80_coverage,
    accuracy: w.waste_level_classification.accuracy, f1_macro: w.waste_level_classification.f1_macro,
    roc_auc: w.waste_level_classification.roc_auc_ovr_macro, baseline_accuracy: w.waste_level_classification.baseline_accuracy,
  },
  matching: m && { model: m.selected, ...m.test, top_pick: m.ranking_top_pick },
  rag: rag && {
    chunks: rag.index.chunks, embedding: rag.index.embedding, vector_backend: rag.index.vector_backend,
    questions: rag.answerable_questions, out_of_scope: rag.out_of_scope_questions,
    retrieval: rag.retrieval.map(({ chunks, search, ...r }) => ({ chunks, search, hit1: r['hit@1'], hit3: r['hit@3'], mrr: r.mrr })),
    graph_fact_accuracy: rag.graph?.fact_accuracy ?? null, graph_questions: rag.graph?.questions ?? null,
    models: (rag.models ?? []).map((x) => ({ model: x.model, answer_accuracy: x.answer_accuracy, citation_rate: x.citation_rate,
      refusal_accuracy: x.refusal_accuracy, median_seconds: x.median_seconds })),
  },
  graph: graph && { entities: graph.nodes.length, relationships: graph.edges.length, mentions: graph.mentions.length },
  index_chunking: index?.chunking ?? null,
  warehouse: wh && { rows: wh.row_counts, headline: wh.headline },
  lakehouse: lake && Object.fromEntries(Object.entries(lake.tables).map(([k, v]) => [k, { rows: v.rows, version: v.version, partitions: v.partition_columns }])),
};
fs.mkdirSync(path.join(root, 'lib', 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'lib', 'docs', 'metrics.json'), JSON.stringify(out, null, 2) + '\n');
console.log('[docs] lib/docs/metrics.json updated');
