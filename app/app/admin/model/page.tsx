import { Activity, BrainCircuit, Network, Scale } from 'lucide-react';
import { Card, ErrorState, Notice, PageHeader, Pill, StatCard, Table } from '@/components/app/ui';
import { SimpleBars } from '@/components/app/charts';
import { ConfusionMatrix } from '@/components/app/confusion-matrix';
import { Stagger } from '@/components/motion';
import { modelMonitoring } from '@/lib/admin';
import { fmtDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'ML Model Monitoring — FoodSphere AI' };

const pct = (v: number | undefined) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);
const n3 = (v: unknown) => (typeof v === 'number' ? v.toFixed(3) : String(v ?? '—'));
type Row = Record<string, string | number>;

function CompareTable({ rows, cols, highlight }: { rows: Row[]; cols: [string, string][]; highlight: string }) {
  return (
    <Table head={['Model', ...cols.map(([, l]) => l)]}>
      {rows.map((r) => (
        <tr key={String(r.model)} className={String(r.model) === highlight ? 'bg-accent/60 font-semibold' : ''}>
          <td className="px-4 py-2">{String(r.model)}{String(r.model) === highlight && <span className="ml-2"><Pill tone="green">Deployed</Pill></span>}</td>
          {cols.map(([k]) => <td key={k} className="px-4 py-2 tabular-nums">{n3(r[k])}</td>)}
        </tr>
      ))}
    </Table>
  );
}

function Metrics({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-lg border p-3">
          <dt className="text-xs text-muted-foreground">{k}</dt>
          <dd className="text-xl font-bold tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function ModelMonitoring() {
  const m = modelMonitoring();
  const w = m.waste;
  const mt = m.matching;
  return (
    <>
      <PageHeader title="ML Model Monitoring" description="Deployment is not evidence of accuracy. All scores below come from held-out test data the models never saw during training." />

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" itemClassName="h-full">
        <StatCard label="Leftover model" icon={Scale} tone="green" value={w ? `±${w.leftover.test.MAE.toFixed(1)} units` : '—'} hint={w ? `${w.leftover.algorithm} · R² ${w.leftover.test.R2.toFixed(3)}` : 'Unavailable'} />
        <StatCard label="Waste-risk model" icon={BrainCircuit} tone="green" value={w ? pct(w.level.test.accuracy) : '—'} hint={w ? `${w.level.algorithm} · macro-F1 ${w.level.test.f1_macro.toFixed(3)}` : 'Unavailable'} />
        <StatCard label="Matching model (synthetic data)" icon={Network} tone="amber" value={mt ? pct(mt.test.accuracy) : '—'} hint={mt ? `${mt.algorithm} · F1 ${mt.test.f1.toFixed(3)} · AUC ${mt.test.roc_auc.toFixed(3)}` : 'Unavailable'} />
        <StatCard label="Predictions served" icon={Activity} value={m.counts.predictions} hint={`${m.counts.failures} failures · ${m.counts.validationFailures} rejected inputs`} />
      </Stagger>

      {(m.loadErrors.waste || m.loadErrors.matching) && (
        <div className="mt-6"><ErrorState title="A model could not be loaded">{m.loadErrors.waste ?? m.loadErrors.matching}. The platform keeps working without it.</ErrorState></div>
      )}

      {w && (
        <>
          <h2 className="mb-3 mt-10 text-xl font-bold">Feature 1 — Predicting leftovers</h2>
          <Notice tone="info" title="Dataset">
            {w.dataset.name}: {w.dataset.rows_raw.toLocaleString()} records ({w.dataset.period}). Chronological split — train {w.dataset.split.train[2]} · validation {w.dataset.split.validation[2]} · test {w.dataset.split.test[2]} rows (test = {w.dataset.split.test[0]} to {w.dataset.split.test[1]}).
            Columns only known at the end of the day were removed: {w.leakage.join(', ')}.
          </Notice>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Card title="1a · Leftover amount (regression)" description={w.leftover.approach}>
              <Metrics items={[
                ['MAE (units)', w.leftover.test.MAE.toFixed(2)], ['RMSE', w.leftover.test.RMSE.toFixed(2)], ['R²', w.leftover.test.R2.toFixed(3)],
                ['Within ±10 units', pct(w.leftover.test.within_10_units)], ['80% range coverage', pct(w.leftover.test.interval_80_coverage)], ['Baseline MAE', w.leftover.test.baseline_mean_MAE.toFixed(1)],
              ]} />
              <div className="mt-4"><CompareTable rows={w.leftover.comparison_test as Row[]} cols={[['MAE', 'MAE'], ['RMSE', 'RMSE'], ['R2', 'R²']]} highlight={w.leftover.algorithm} /></div>
              <p className="mt-3 text-xs text-muted-foreground">Honest note: the historical-average rule is a strong baseline on this dataset ({w.leftover.test.baseline_rule_MAE.toFixed(2)} MAE). The AI model matches it on error and slightly improves R², and also adapts to new combinations of weather, promotion and stock levels.</p>
            </Card>
            <Card title="1b · Waste risk level (classification)" description={`${w.level.algorithm} · chosen by accuracy over 5 rolling time periods · imbalance handling: ${w.level.imbalance}`}>
              <Metrics items={[
                ['Accuracy', pct(w.level.test.accuracy)], ['Precision (macro)', w.level.test.precision_macro.toFixed(3)], ['Recall (macro)', w.level.test.recall_macro.toFixed(3)],
                ['F1 (macro)', w.level.test.f1_macro.toFixed(3)], ['ROC-AUC', w.level.test.roc_auc_ovr_macro.toFixed(3)], ['Baseline acc.', pct(w.level.test.baseline_accuracy)],
              ]} />
              <div className="mt-5 grid gap-6 lg:grid-cols-2">
                <ConfusionMatrix matrix={w.level.confusion_matrix} labels={w.level.labels} title="Confusion matrix (test set)" />
                <Table head={['Class', 'Precision', 'Recall', 'F1', 'Support']}>
                  {w.level.labels.map((l) => {
                    const r = w.level.report[l] as Record<string, number>;
                    return <tr key={l}><td className="px-3 py-2 font-medium">{l}</td><td className="px-3 py-2">{r.precision.toFixed(3)}</td><td className="px-3 py-2">{r.recall.toFixed(3)}</td><td className="px-3 py-2">{r['f1-score'].toFixed(3)}</td><td className="px-3 py-2">{r.support}</td></tr>;
                  })}
                </Table>
              </div>
            </Card>
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <h3 className="mb-3 font-semibold">Waste-level models compared on the test set</h3>
              <CompareTable rows={w.level.comparison_test as Row[]} cols={[['accuracy', 'Accuracy'], ['precision_macro', 'Precision'], ['recall_macro', 'Recall'], ['f1_macro', 'F1'], ['roc_auc', 'ROC-AUC']]} highlight={w.level.algorithm} />
            </div>
            <Card title="What drives waste risk" description="Permutation importance (test set)">
              <SimpleBars horizontal height={300} data={Object.entries(w.level.feature_importance).slice(0, 8).map(([k, v]) => ({ name: k.replace(/_/g, ' '), value: Math.round(v * 1000) / 10 }))} unit="%" />
            </Card>
          </div>
        </>
      )}

      {mt && (
        <>
          <h2 className="mb-3 mt-10 text-xl font-bold">Feature 2 — Finding the right organization</h2>
          <Notice tone="warning" title="Trained on SYNTHETIC data">
            No public dataset records real donation outcomes, so this model was trained on a clearly-labelled simulated dataset ({mt.dataset.rows_raw.toLocaleString()} offers, {mt.dataset.donations.toLocaleString()} donations, {mt.dataset.organizations} fictional organizations).
            Scores show that the pipeline works, not real-world accuracy. Safety rules always run first; the model only ranks organizations that are already eligible. Re-train on real platform outcomes before relying on it.
          </Notice>
          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Card title="Successful-match classifier" description={`${mt.algorithm} · selected on validation ROC-AUC (ranking quality)`}>
              <Metrics items={[
                ['Accuracy', pct(mt.test.accuracy)], ['Precision', mt.test.precision.toFixed(3)], ['Recall', mt.test.recall.toFixed(3)],
                ['F1', mt.test.f1.toFixed(3)], ['ROC-AUC', mt.test.roc_auc.toFixed(3)], ['Baseline acc.', pct(mt.test.baseline_accuracy)],
              ]} />
              <div className="mt-5"><ConfusionMatrix matrix={mt.confusion_matrix} labels={mt.labels} title="Confusion matrix (test set)" /></div>
            </Card>
            <Card title="Does it pick a good organization?" description="Share of test donations where the top-ranked eligible organization succeeded">
              <Table head={['Method', 'Top pick succeeded']}>
                {mt.ranking_test.map((r) => (
                  <tr key={r.method}><td className="px-4 py-2">{r.method}</td><td className="px-4 py-2 font-semibold tabular-nums">{pct(r.top_pick_success_rate)}</td></tr>
                ))}
              </Table>
              <p className="mt-3 text-xs text-muted-foreground">The AI ranking performs on par with the hand-tuned rule formula and better than “nearest” or random choice. Its added value is a success probability per organization that can be re-learned from real outcomes.</p>
            </Card>
          </div>
          <div className="mt-6">
            <h3 className="mb-3 font-semibold">Matching models compared on the test set</h3>
            <CompareTable rows={mt.comparison_test as Row[]} cols={[['accuracy', 'Accuracy'], ['precision', 'Precision'], ['recall', 'Recall'], ['f1', 'F1'], ['roc_auc', 'ROC-AUC']]} highlight={mt.algorithm} />
          </div>
        </>
      )}

      <h2 className="mb-3 mt-10 text-xl font-bold">Data preprocessing summary</h2>
      <div className="grid gap-6 xl:grid-cols-2">
        {w && <Card title="Kaggle food-waste dataset"><dl className="grid grid-cols-2 gap-2 text-sm">{Object.entries(w.cleaning).map(([k, v]) => <div key={k} className="flex justify-between gap-2 border-b py-1"><dt className="text-muted-foreground">{k.replace(/_/g, ' ')}</dt><dd className="font-semibold tabular-nums">{v}</dd></div>)}</dl></Card>}
        {mt && <Card title="Synthetic matching dataset"><dl className="grid grid-cols-2 gap-2 text-sm">{Object.entries(mt.cleaning).map(([k, v]) => <div key={k} className="flex justify-between gap-2 border-b py-1"><dt className="text-muted-foreground">{k.replace(/_/g, ' ')}</dt><dd className="font-semibold tabular-nums">{v}</dd></div>)}</dl></Card>}
      </div>

      <div className="mt-10 grid gap-6 xl:grid-cols-3">
        <Card title="Drift indicator" description="Live leftover error vs test error">
          <Pill tone={m.drift.status === 'stable' ? 'green' : m.drift.status === 'insufficient_data' ? 'default' : m.drift.status === 'watch' ? 'amber' : 'red'}>
            {m.drift.status === 'insufficient_data' ? 'Insufficient data' : m.drift.status[0].toUpperCase() + m.drift.status.slice(1)}
          </Pill>
          <p className="mt-2 text-sm text-muted-foreground">{m.drift.message}</p>
          {m.live.mae != null && <p className="mt-1 text-sm">Live MAE on {m.live.evaluated} forecasts: <strong>{m.live.mae}</strong></p>}
          <p className="mt-3 text-xs text-muted-foreground">Retraining is an admin task: re-run the notebooks in <code>ml/</code>, review the test results, then replace the files in <code>lib/model/</code>. It never runs on user requests.</p>
        </Card>
        <div className="xl:col-span-2">
          <h3 className="mb-3 font-semibold">Recent prediction history</h3>
          <Table head={['Time', 'Organization', 'Category', 'For', 'Leftover', 'Risk', 'Status']}>
            {m.recent.map((r) => {
              let meta: { waste_level?: string } = {};
              try { meta = JSON.parse(String(r.meta)) ?? {}; } catch { /* none */ }
              return (
                <tr key={Number(r.id)}>
                  <td className="px-4 py-2 whitespace-nowrap">{fmtDateTime(String(r.prediction_timestamp))}</td>
                  <td className="px-4 py-2">{r.organization_name ?? '—'}</td>
                  <td className="px-4 py-2">{r.food_category ?? '—'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{r.forecast_date ?? '—'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{r.forecast_quantity != null ? `${r.lower_bound}–${r.upper_bound}` : '—'}</td>
                  <td className="px-4 py-2">{meta.waste_level ?? '—'}</td>
                  <td className="px-4 py-2">{r.validation_status === 'valid' ? <Pill tone="green">Valid</Pill> : <Pill tone="amber">{String(r.validation_status).replace('_', ' ')}</Pill>}</td>
                </tr>
              );
            })}
          </Table>
          {m.recent.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No predictions yet.</p>}
        </div>
      </div>
    </>
  );
}
