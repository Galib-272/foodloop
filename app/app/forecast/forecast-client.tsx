'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Info, Loader2, Sparkles, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Field, FormAlert, selectClass } from '@/components/forms/field';
import { SurplusChart, type SurplusPoint } from '@/components/app/charts';
import { GrowBar, Presence, Stagger } from '@/components/motion';
import { apiFetch } from '@/lib/client';
import type { ForecastResult } from '@/lib/forecast';
import { cn } from '@/lib/utils';

type Defaults = Record<string, Record<string, { purchase_quantity: number; shelf_life_days: number | null; storage_temperature: number | null; source: string }>>;
type Series = { points: SurplusPoint[]; forecastOk: boolean };

// Deterministic (no locale APIs) so server and browser render identical text.
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const nice = (iso: string) => { const d = new Date(iso + 'T00:00:00Z'); return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MO[d.getUTCMonth()]}`; };

const LEVEL_STYLE: Record<string, { cls: string; bar: string; icon: typeof CheckCircle2 }> = {
  Low: { cls: 'bg-green-50 text-green-800 ring-green-600/20', bar: 'bg-green-600', icon: CheckCircle2 },
  Medium: { cls: 'bg-amber-50 text-amber-800 ring-amber-600/25', bar: 'bg-amber-500', icon: TriangleAlert },
  High: { cls: 'bg-red-50 text-red-800 ring-red-600/20', bar: 'bg-red-600', icon: AlertTriangle },
};

export function ForecastClient({ days, categories, defaults, shelfMedian, tempMedian }: {
  days: string[]; categories: string[]; defaults: Defaults; shelfMedian: Record<string, number>; tempMedian: Record<string, number>;
}) {
  const [date, setDate] = useState(days[0]);
  const [category, setCategory] = useState('all');
  const [weather, setWeather] = useState('');
  const [promotion, setPromotion] = useState(false);
  const [purchase, setPurchase] = useState<Record<string, string>>({});
  const [shelf, setShelf] = useState<Record<string, string>>({});
  const [temp, setTemp] = useState<Record<string, string>>({});
  const [series, setSeries] = useState<Series | null>(null);
  const [result, setResult] = useState<ForecastResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const cats = category === 'all' ? categories : [category];
  const def = defaults[date] ?? {};

  const loadSeries = useCallback(async () => {
    const { data } = await apiFetch<Series>(`/api/forecasts/series?category=${encodeURIComponent(category)}&days=30`);
    if (data) setSeries(data);
  }, [category]);
  useEffect(() => { loadSeries(); }, [loadSeries]);

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    const nums = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).filter(([k, v]) => cats.includes(k) && v !== '' && !Number.isNaN(Number(v))).map(([k, v]) => [k, Number(v)]));
    const { data, error } = await apiFetch<ForecastResult>('/api/forecasts/predict', {
      body: { category, date, weather: weather || null, promotion, purchase: nums(purchase), shelf_life: nums(shelf), storage_temperature: nums(temp) },
    });
    setLoading(false);
    if (error) { setError(error.message); setResult(null); return; }
    setResult(data);
    if (!data!.ok) setError(data!.error ?? 'Forecast unavailable.');
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <form onSubmit={run} className="h-fit space-y-5 rounded-xl border bg-card p-5" aria-label="Forecast inputs">
        <div>
          <h2 className="font-semibold">Tomorrow’s plan (morning inputs)</h2>
          <p className="text-xs text-muted-foreground">Only information known before the day starts is used.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field id="fc-date" label="Day">
            <select id="fc-date" className={selectClass} value={date} onChange={(e) => { setDate(e.target.value); setResult(null); }}>
              {days.map((d, i) => <option key={d} value={d}>{nice(d)}{i === 0 ? ' (today)' : ''}</option>)}
            </select>
          </Field>
          <Field id="fc-cat" label="Food category">
            <select id="fc-cat" className={selectClass} value={category} onChange={(e) => { setCategory(e.target.value); setResult(null); }}>
              <option value="all">All my categories</option>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field id="fc-weather" label="Weather forecast">
            <select id="fc-weather" className={selectClass} value={weather} onChange={(e) => setWeather(e.target.value)}>
              <option value="">Not sure (typical)</option>
              {['Sunny', 'Cloudy', 'Rainy', 'Hot'].map((w) => <option key={w}>{w}</option>)}
            </select>
          </Field>
          <label className="flex items-end justify-between gap-2 pb-2 text-sm font-medium">
            Promotion
            <Switch checked={promotion} onCheckedChange={setPromotion} aria-label="Promotion planned" />
          </label>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Planned purchase / preparation (units)</legend>
          {cats.map((c) => (
            <div key={c} className="grid grid-cols-[1fr_110px] items-center gap-2">
              <label htmlFor={`pq-${c}`} className="text-sm">{c}</label>
              <Input id={`pq-${c}`} type="number" min={1} className="h-9" placeholder={String(def[c]?.purchase_quantity ?? '')}
                value={purchase[c] ?? ''} onChange={(e) => setPurchase((p) => ({ ...p, [c]: e.target.value }))} />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Leave blank to use your usual amount (shown in grey).</p>
        </fieldset>
        <details className="rounded-lg border p-3">
          <summary className="cursor-pointer text-sm font-medium">Shelf life & storage temperature</summary>
          <div className="mt-3 space-y-2">
            {cats.map((c) => (
              <div key={c} className="grid grid-cols-[1fr_72px_72px] items-center gap-2">
                <span className="truncate text-xs">{c}</span>
                <Input aria-label={`${c} shelf life (days)`} type="number" min={1} className="h-8" placeholder={`${def[c]?.shelf_life_days ?? shelfMedian[c]} d`}
                  value={shelf[c] ?? ''} onChange={(e) => setShelf((p) => ({ ...p, [c]: e.target.value }))} />
                <Input aria-label={`${c} storage temperature (°C)`} type="number" step="0.1" className="h-8" placeholder={`${def[c]?.storage_temperature ?? tempMedian[c]}°C`}
                  value={temp[c] ?? ''} onChange={(e) => setTemp((p) => ({ ...p, [c]: e.target.value }))} />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Days · °C. Blank = your last recorded value or the category’s normal value.</p>
          </div>
        </details>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Predict leftovers
        </Button>
      </form>

      <div className="min-w-0 space-y-6">
        <FormAlert message={error} />
        {!result && !error && (
          <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">Set tomorrow’s plan and press <strong>Predict leftovers</strong>.</div>
        )}
        <Presence show={!!result?.ok} id={result?.prediction_timestamp}>
          {result?.ok && (
            <section className="space-y-4" aria-live="polite">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Estimate for {nice(result.target_date)}</h2>
                <p className="text-xs text-muted-foreground">Model {result.model_version} · business type: {result.business_type}</p>
              </div>
              <Stagger className="grid gap-4 md:grid-cols-2" itemClassName="h-full">
                {result.groups.map((g) => {
                  const st = LEVEL_STYLE[g.waste_level];
                  const Icon = st.icon;
                  return (
                    <article key={g.food_category} className="flex h-full flex-col rounded-xl border bg-card p-5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-secondary">{g.food_category}</p>
                        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', st.cls)}>
                          <Icon className="h-3 w-3" aria-hidden="true" />{g.waste_level} waste risk
                        </span>
                      </div>
                      <p className="mt-1 text-3xl font-bold tracking-tight">{g.lower}–{g.upper} <span className="text-lg font-semibold">units</span></p>
                      <p className="text-sm text-muted-foreground">likely left over (best estimate {g.leftover}) from {g.purchase_quantity} planned · 80% range</p>
                      <div className="mt-4 space-y-1.5" aria-label="Waste risk probabilities">
                        {['Low', 'Medium', 'High'].map((lvl) => (
                          <div key={lvl} className="grid grid-cols-[60px_1fr_40px] items-center gap-2 text-xs">
                            <span>{lvl}</span>
                            <GrowBar percent={Math.round((g.probabilities[lvl] ?? 0) * 100)} barClassName={LEVEL_STYLE[lvl].bar} />
                            <span className="text-right tabular-nums">{Math.round((g.probabilities[lvl] ?? 0) * 100)}%</span>
                          </div>
                        ))}
                      </div>
                      <ul className="mt-4 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                        {g.factors.map((f) => <li key={f}>{f}</li>)}
                        <li>Planned amount: {g.purchase_source}.</li>
                      </ul>
                      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
                        <p className="text-xs text-muted-foreground">{g.leftover >= 3 ? 'Suggested: plan a donation or buy/prepare less.' : 'Little or no leftover expected.'}</p>
                        <Button asChild size="sm" disabled={g.leftover < 1}>
                          <Link href={`/app/donations/new?forecast=${g.forecast_id}`}>Create Donation <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </Stagger>
            </section>
          )}
        </Presence>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Leftover: actual vs AI estimate ({category === 'all' ? 'all categories' : category})</h2>
          <p className="text-sm text-muted-foreground">Past 30 days: solid = what was actually left over, dashed = what the model would have predicted that morning. Next days: forecast with your usual amounts and an 80% range.</p>
          <div className="mt-4">{series ? (series.points.length ? <SurplusChart data={series.points} unit="units" /> : <p className="py-10 text-center text-sm text-muted-foreground">No history for this category yet.</p>) : <div className="h-[340px] animate-pulse rounded-lg bg-muted" />}</div>
          {series && !series.forecastOk && <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Info className="h-3.5 w-3.5" />Forecast line unavailable.</p>}
        </section>
      </div>
    </div>
  );
}
