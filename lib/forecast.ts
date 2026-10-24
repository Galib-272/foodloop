import { getDb, nowIso } from './db';
import { FOOD_CATEGORIES, MODEL_BUSINESS_TYPE } from './constants';
import { getOrgByUser } from './orgs';
import { loadWasteModel, predictWaste, wasteModelError, type WastePrediction } from './ml/waste';

/*
 * Leftover forecasting service (Feature 1). Models: lib/model/waste-models.json, trained in
 * ml/waste/01_waste_model.ipynb on the Kaggle food-waste dataset. Predictions are made for the morning
 * of a day, are always shown as estimates, and never create a donation automatically.
 * If the model file is missing the rest of the platform keeps working.
 */

export const HORIZON_DAYS = 7;
const r1 = (v: number) => Math.round(v * 10) / 10;

export const dhakaToday = () => new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function loadModel() {
  return loadWasteModel();
}
export function modelError() {
  return wasteModelError();
}

export function historyRange(donorId: number) {
  const r = getDb().prepare('SELECT MIN(date) AS a, MAX(date) AS b, COUNT(*) AS n FROM sales_history WHERE donor_id = ?').get(donorId)!;
  return { first: (r.a as string) ?? null, last: (r.b as string) ?? null, rows: Number(r.n) };
}

export function donorBusinessType(donorId: number) {
  const org = getOrgByUser(donorId);
  return MODEL_BUSINESS_TYPE[org?.organization_type ?? 'Restaurant'] ?? 'Restaurant';
}

/** Categories this donor has history for (else all model categories). */
export function donorCategories(donorId: number): string[] {
  const rows = getDb().prepare('SELECT DISTINCT food_category FROM sales_history WHERE donor_id = ? ORDER BY food_category').all(donorId);
  const cats = rows.map((r) => String(r.food_category)).filter((c) => (FOOD_CATEGORIES as readonly string[]).includes(c));
  return cats.length ? cats : [...FOOD_CATEGORIES];
}

export type CategoryDefaults = { purchase_quantity: number; shelf_life_days: number | null; storage_temperature: number | null; source: string };

/** Sensible morning inputs from the donor's own recent history (same weekday first). */
export function defaultsFor(donorId: number, category: string, date: string): CategoryDefaults {
  const db = getDb();
  const dow = new Date(date + 'T00:00:00Z').getUTCDay(); // SQLite strftime('%w'): Sunday = 0
  const same = db
    .prepare(`SELECT AVG(purchase_quantity) AS p FROM (SELECT purchase_quantity FROM sales_history WHERE donor_id = ? AND food_category = ?
              AND CAST(strftime('%w', date) AS INTEGER) = ? AND date < ? ORDER BY date DESC LIMIT 4)`)
    .get(donorId, category, dow, date);
  const recent = db
    .prepare(`SELECT AVG(purchase_quantity) AS p FROM (SELECT purchase_quantity FROM sales_history WHERE donor_id = ? AND food_category = ? AND date < ? ORDER BY date DESC LIMIT 28)`)
    .get(donorId, category, date);
  const last = db
    .prepare(`SELECT shelf_life_days AS s, storage_temperature AS t FROM sales_history WHERE donor_id = ? AND food_category = ? AND shelf_life_days IS NOT NULL ORDER BY date DESC LIMIT 1`)
    .get(donorId, category);
  const model = loadWasteModel();
  let purchase = Number(same?.p ?? recent?.p ?? NaN);
  let source = same?.p != null ? 'average purchase on the same weekday (last 4 weeks)' : recent?.p != null ? 'average purchase (last 28 days)' : '';
  if (!(purchase > 0)) {
    const exp = model?.artifacts.exp_demand_k2[`${donorBusinessType(donorId)}|${category}`] ?? 100;
    purchase = exp * 1.1;
    source = 'typical demand for this business type (no history yet)';
  }
  return {
    purchase_quantity: Math.round(purchase),
    shelf_life_days: last?.s != null ? Number(last.s) : null,
    storage_temperature: last?.t != null ? Number(last.t) : null,
    source,
  };
}

export type ForecastRequest = {
  date: string;
  category: string; // a category or 'all'
  weather?: string | null;
  promotion?: boolean;
  purchase?: Record<string, number>;
  shelf_life?: Record<string, number>;
  storage_temperature?: Record<string, number>;
  log?: boolean; // false for dashboard previews (not counted in model monitoring)
};

export type ForecastGroup = WastePrediction & {
  food_category: string;
  unit: 'units';
  purchase_quantity: number;
  purchase_source: string;
  forecast_id: number;
};

export type ForecastResult = {
  ok: boolean;
  error?: string;
  validation_status: 'valid' | 'invalid_input' | 'model_unavailable';
  model_version: string | null;
  prediction_timestamp: string;
  target_date: string;
  horizon_days: number;
  business_type: string;
  groups: ForecastGroup[];
  interval_level: number;
};

function logRow(donorId: number, data: Record<string, unknown>) {
  return Number(
    getDb()
      .prepare(
        `INSERT INTO forecast_records (donor_id, target_type, food_category, forecast_quantity, lower_bound, upper_bound, unit, forecast_period,
          forecast_date, model_version, prediction_timestamp, input_reference, validation_status, error, evaluation_or_uncertainty_metadata)
         VALUES (?, 'leftover', ?, ?, ?, ?, 'units', ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(donorId, data.category ?? null, data.q ?? null, data.lo ?? null, data.hi ?? null, data.period ?? null, data.date ?? null,
        data.version ?? null, nowIso(), data.input ? JSON.stringify(data.input) : null, data.status ?? 'valid', data.error ?? null,
        data.meta ? JSON.stringify(data.meta) : null).lastInsertRowid
  );
}

export function runForecast(donorId: number, req: ForecastRequest): ForecastResult {
  const ts = nowIso();
  const log = req.log === false ? () => 0 : (d: Record<string, unknown>) => logRow(donorId, d);
  const business = donorBusinessType(donorId);
  const base = { prediction_timestamp: ts, target_date: req.date, business_type: business, groups: [] as ForecastGroup[], interval_level: 0.8 };
  const b = loadWasteModel();
  if (!b) {
    log({ category: req.category, status: 'model_unavailable', error: wasteModelError(), date: req.date });
    return { ...base, ok: false, horizon_days: 0, model_version: null, validation_status: 'model_unavailable',
      error: 'The forecasting model is temporarily unavailable. You can still create donations manually.' };
  }
  const today = dhakaToday();
  const horizon = Math.round((Date.parse(req.date) - Date.parse(today)) / 86400_000);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(req.date) || horizon < 0 || horizon > HORIZON_DAYS) {
    log({ category: req.category, status: 'invalid_input', error: `horizon ${horizon}`, version: b.version, date: req.date });
    return { ...base, ok: false, horizon_days: horizon, model_version: b.version, validation_status: 'invalid_input',
      error: `Choose a day from today to ${HORIZON_DAYS} days ahead.` };
  }
  const cats = req.category === 'all' ? donorCategories(donorId) : [req.category];
  const groups: ForecastGroup[] = [];
  for (const cat of cats) {
    const def = defaultsFor(donorId, cat, req.date);
    const purchase = req.purchase?.[cat] && req.purchase[cat] > 0 ? Number(req.purchase[cat]) : def.purchase_quantity;
    const input = {
      date: req.date, business_type: business, food_category: cat, purchase_quantity: purchase,
      shelf_life_days: req.shelf_life?.[cat] ?? def.shelf_life_days, storage_temperature: req.storage_temperature?.[cat] ?? def.storage_temperature,
      promotion: (req.promotion ? 1 : 0) as 0 | 1, weather: req.weather || null,
    };
    const p = predictWaste(input, b);
    const id = log({
      category: cat, q: p.leftover, lo: p.lower, hi: p.upper, period: `${horizon}d`, date: req.date, version: b.version, input,
      meta: { waste_level: p.waste_level, probabilities: p.probabilities, predicted_demand: p.demand, interval_level: 0.8, test_mae: b.leftover.test.MAE },
    });
    groups.push({ ...p, food_category: cat, unit: 'units', purchase_quantity: purchase,
      purchase_source: req.purchase?.[cat] ? 'entered by you' : def.source, forecast_id: id });
  }
  groups.sort((a, c) => c.leftover - a.leftover);
  return { ...base, ok: true, validation_status: 'valid', model_version: b.version, horizon_days: horizon, groups };
}

/**
 * Chart data: for past days, the actual leftover (purchase − sold) next to what the model would have predicted
 * with that day's inputs; for the next days, the forecast with typical inputs and an 80% range.
 */
export function leftoverSeries(donorId: number, category = 'all', pastDays = 30, futureDays = 7) {
  const b = loadWasteModel();
  const range = historyRange(donorId);
  const business = donorBusinessType(donorId);
  const label = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  type Pt = { date: string; label: string; historical: number | null; predicted: number | null; range: [number, number] | null };
  const points: Pt[] = [];
  if (range.last) {
    const from = addDays(range.last, -(pastDays - 1));
    const rows = getDb()
      .prepare(
        `SELECT * FROM sales_history WHERE donor_id = ? ${category !== 'all' ? 'AND food_category = ?' : ''} AND date >= ? ORDER BY date`
      )
      .all(...([donorId, ...(category !== 'all' ? [category] : []), from] as (string | number)[]));
    const byDate = new Map<string, { actual: number; pred: number }>();
    for (const r of rows) {
      const cur = byDate.get(String(r.date)) ?? { actual: 0, pred: 0 };
      cur.actual += Math.max(0, Number(r.purchase_quantity) - Number(r.units_sold));
      if (b) {
        cur.pred += predictWaste({ date: String(r.date), business_type: business, food_category: String(r.food_category), purchase_quantity: Number(r.purchase_quantity),
          shelf_life_days: r.shelf_life_days as number | null, storage_temperature: r.storage_temperature as number | null,
          promotion: Number(r.promotion) ? 1 : 0, weather: (r.weather as string | null) ?? null }, b).leftover;
      }
      byDate.set(String(r.date), cur);
    }
    byDate.forEach((v, d) => points.push({ date: d, label: label(d), historical: r1(v.actual), predicted: b ? r1(v.pred) : null, range: null }));
  }
  let next: { date: string; predicted: number; lower: number; upper: number; level: string } | null = null;
  if (b) {
    const today = dhakaToday();
    for (let h = 0; h < futureDays; h++) {
      const date = addDays(today, h);
      if (range.last && date <= range.last) continue;
      const f = runForecast(donorId, { date, category, log: false });
      if (!f.ok) continue;
      const pred = f.groups.reduce((s, g) => s + g.leftover, 0);
      // combine per-category ranges in quadrature (independent errors; approximate)
      const lo = Math.sqrt(f.groups.reduce((s, g) => s + (g.leftover - g.lower) ** 2, 0));
      const hi = Math.sqrt(f.groups.reduce((s, g) => s + (g.upper - g.leftover) ** 2, 0));
      const pt = { date, label: label(date), historical: null, predicted: r1(pred), range: [r1(Math.max(0, pred - lo)), r1(pred + hi)] as [number, number] };
      points.push(pt);
      if (!next) {
        const worst = f.groups.find((g) => g.waste_level === 'High') ?? f.groups.find((g) => g.waste_level === 'Medium') ?? f.groups[0];
        next = { date, predicted: pt.predicted, lower: pt.range[0], upper: pt.range[1], level: worst?.waste_level ?? 'Low' };
      }
    }
  }
  return { points, unit: 'units', lastHistory: range.last, forecastOk: !!b, next };
}

/** Logged forecasts whose day has since been recorded — predicted vs actual leftover. */
export function evaluatedForecasts(donorId: number | null, limit = 300) {
  const rows = getDb()
    .prepare(
      `SELECT f.id, f.donor_id, f.food_category, f.forecast_date, f.forecast_quantity, f.model_version, f.evaluation_or_uncertainty_metadata AS meta,
              (h.purchase_quantity - h.units_sold) AS actual, h.waste_quantity, h.purchase_quantity
       FROM forecast_records f JOIN sales_history h ON h.donor_id = f.donor_id AND h.date = f.forecast_date AND h.food_category = f.food_category
       WHERE f.validation_status = 'valid' AND f.target_type = 'leftover' ${donorId ? 'AND f.donor_id = ?' : ''}
       ORDER BY f.prediction_timestamp DESC LIMIT ?`
    )
    .all(...((donorId ? [donorId, limit] : [limit]) as number[]));
  return rows.map((r) => ({
    id: Number(r.id), donor_id: Number(r.donor_id), food_category: String(r.food_category), forecast_date: String(r.forecast_date),
    forecast_quantity: Number(r.forecast_quantity), model_version: String(r.model_version), actual: Math.max(0, Number(r.actual)),
    error: Math.abs(Math.max(0, Number(r.actual)) - Number(r.forecast_quantity)),
  }));
}
