import Link from 'next/link';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Notice, PageHeader, Pill, Table } from '@/components/app/ui';
import { ForecastClient } from './forecast-client';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { HORIZON_DAYS, addDays, defaultsFor, dhakaToday, donorCategories, loadModel } from '@/lib/forecast';
import { fmtDate, fmtDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'AI Surplus Forecast — FoodSphere AI' };

export default function ForecastPage() {
  const user = requireUser(['donor']);
  const model = loadModel();
  const categories = donorCategories(user.id);
  const today = dhakaToday();
  const days = Array.from({ length: HORIZON_DAYS + 1 }, (_, i) => addDays(today, i));
  const defaults = Object.fromEntries(days.map((d) => [d, Object.fromEntries(categories.map((c) => [c, defaultsFor(user.id, c, d)]))]));
  const recent = getDb()
    .prepare(
      `SELECT f.*, (h.purchase_quantity - h.units_sold) AS actual FROM forecast_records f
       LEFT JOIN sales_history h ON h.donor_id = f.donor_id AND h.date = f.forecast_date AND h.food_category = f.food_category
       WHERE f.donor_id = ? ORDER BY f.prediction_timestamp DESC LIMIT 10`
    )
    .all(user.id);
  const meta = (r: Record<string, unknown>) => { try { return JSON.parse(String(r.evaluation_or_uncertainty_metadata)) ?? {}; } catch { return {}; } };

  return (
    <>
      <PageHeader title="AI Surplus Forecast" description="Predict in the morning how much food will be left over and how high the waste risk is — then donate early or prepare less."
        actions={<Button asChild variant="outline"><Link href="/app/import"><Upload className="mr-2 h-4 w-4" />Import history</Link></Button>} />
      <div className="mb-6">
        <Notice tone="info" title="Forecasts are estimates">
          {model ? (
            <>Trained on the <strong>{model.dataset.name}</strong> ({model.dataset.rows_clean.toLocaleString()} records). On unseen test days the leftover model was off by
              about <strong>{model.leftover.test.MAE.toFixed(1)} units</strong> on average (R² {model.leftover.test.R2.toFixed(2)}), and the waste-risk model was right{' '}
              <strong>{Math.round(model.waste_level.test.accuracy * 100)}%</strong> of the time (vs {Math.round(model.waste_level.test.baseline_accuracy * 100)}% by always guessing “Low”).
              A forecast never creates a donation by itself — you confirm the real quantity.</>
          ) : (
            <>The forecasting model is currently unavailable. You can still create and manage donations manually.</>
          )}
        </Notice>
      </div>
      {model && (
        <ForecastClient days={days} categories={categories} defaults={defaults}
          shelfMedian={model.artifacts.shelf_life_median} tempMedian={model.artifacts.storage_temp_median} />
      )}
      {recent.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 font-semibold">Recent forecasts</h2>
          <Table head={['When', 'Category', 'For date', 'Predicted leftover', 'Waste risk', 'Actual', 'Status']}>
            {recent.map((f) => {
              const m = meta(f);
              return (
                <tr key={f.id}>
                  <td className="px-4 py-2.5 whitespace-nowrap">{fmtDateTime(String(f.prediction_timestamp))}</td>
                  <td className="px-4 py-2.5">{f.food_category ?? 'All'}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(f.forecast_date ? String(f.forecast_date) : null)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{f.forecast_quantity != null ? `${f.lower_bound}–${f.upper_bound} units` : '—'}</td>
                  <td className="px-4 py-2.5">{m.waste_level ? <Pill tone={m.waste_level === 'High' ? 'red' : m.waste_level === 'Medium' ? 'amber' : 'green'}>{m.waste_level}</Pill> : '—'}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{f.actual != null ? `${Math.max(0, Number(f.actual))} units` : 'not yet recorded'}</td>
                  <td className="px-4 py-2.5">{f.validation_status === 'valid' ? 'Valid' : <span className="text-destructive">{String(f.validation_status).replace('_', ' ')}</span>}</td>
                </tr>
              );
            })}
          </Table>
        </div>
      )}
    </>
  );
}
