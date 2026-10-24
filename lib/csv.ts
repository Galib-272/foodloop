import { FOOD_CATEGORIES, WEATHER } from './constants';

/*
 * CSV parsing and validation. Uploaded files are untrusted data: they are parsed as text
 * only, never evaluated. Row/size limits are enforced by the caller.
 */

export function parseCsv(text: string, maxRows: number): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
      if (rows.length > maxRows + 1) throw new Error(`File has more than ${maxRows} rows.`);
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

/** Neutralise spreadsheet formula injection in exported cells. */
export function csvCell(v: unknown): string {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\r\n');
}

export type CellIssue = { row: number; column: string; message: string; severity: 'error' | 'warning' };

/** One day of history for one food category — same structure as the Kaggle food-waste dataset. */
export type HistoryRecord = {
  date: string;
  food_category: string;
  purchase_quantity: number;
  units_sold: number;
  waste_quantity: number;
  shelf_life_days: number | null;
  storage_temperature: number | null;
  promotion: number;
  weather: string | null;
};

export const HISTORY_COLUMNS = [
  'date', 'food_category', 'purchase_quantity', 'units_sold', 'waste_quantity', 'shelf_life_days', 'storage_temperature', 'promotion', 'weather',
] as const;
export const REQUIRED_COLUMNS = ['date', 'food_category', 'purchase_quantity', 'units_sold'];

// Accept the Kaggle column names too (e.g. Purchase_Quantity, Units_Sold), so the original file can be imported.
export const COLUMN_ALIASES: Record<string, string> = {
  waste_quantity: 'waste_quantity', wasted_quantity: 'waste_quantity', purchase: 'purchase_quantity', sold: 'units_sold', sold_quantity: 'units_sold',
  shelf_life: 'shelf_life_days', temperature: 'storage_temperature', storage_temp: 'storage_temperature',
};

function normDate(v: string): string | null {
  const t = v.trim();
  let y: number, m: number, d: number;
  let mt = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (mt) [y, m, d] = [Number(mt[1]), Number(mt[2]), Number(mt[3])];
  else if ((mt = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t))) [d, m, y] = [Number(mt[1]), Number(mt[2]), Number(mt[3])]; // DD/MM/YYYY
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

const num = (v: string | undefined) => (v == null || v.trim() === '' ? NaN : Number(v.trim()));

export type ValidationResult = {
  columns: string[];
  rows: Record<string, string>[];
  records: (HistoryRecord | null)[];
  issues: CellIssue[];
  missingColumns: string[];
  summary: { total: number; valid: number; errorRows: number; warningCount: number; duplicates: number };
};

export function validateHistory(table: Record<string, string>[], existingKeys: Set<string> = new Set()): ValidationResult {
  const issues: CellIssue[] = [];
  const records: (HistoryRecord | null)[] = [];
  const seen = new Map<string, number>();
  let duplicates = 0;
  const cats = new Map(FOOD_CATEGORIES.map((c) => [c.toLowerCase(), c as string]));
  const weathers = new Map(WEATHER.map((w) => [w.toLowerCase(), w as string]));
  const today = new Date().toISOString().slice(0, 10);

  table.forEach((raw, i) => {
    const row = i + 1;
    const err = (column: string, message: string) => issues.push({ row, column, message, severity: 'error' });
    const warn = (column: string, message: string) => issues.push({ row, column, message, severity: 'warning' });
    const before = issues.filter((x) => x.severity === 'error').length;

    for (const c of REQUIRED_COLUMNS) if (!raw[c] || !raw[c].trim()) err(c, 'Missing value');

    const date = raw.date ? normDate(raw.date) : null;
    if (raw.date?.trim() && !date) err('date', 'Invalid date (use YYYY-MM-DD)');
    if (date && date > today) err('date', 'Date is in the future');

    const cat = cats.get((raw.food_category ?? '').trim().toLowerCase());
    if (raw.food_category?.trim() && !cat) err('food_category', `Unknown category. Use one of: ${FOOD_CATEGORIES.join(', ')}`);

    const purchase = num(raw.purchase_quantity);
    const sold = num(raw.units_sold);
    const waste = raw.waste_quantity?.trim() ? num(raw.waste_quantity) : 0;
    for (const [col, v] of [['purchase_quantity', purchase], ['units_sold', sold], ['waste_quantity', waste]] as const) {
      if ((raw[col] ?? '').trim() === '' && col === 'waste_quantity') continue;
      if ((raw[col] ?? '').trim() === '') continue;
      if (Number.isNaN(v)) err(col, 'Must be a number');
      else if (v < 0) err(col, 'Negative quantity');
      else if (v > 1_000_000) err(col, 'Unrealistically large value');
    }
    if (!Number.isNaN(purchase) && purchase === 0) err('purchase_quantity', 'Purchase quantity must be greater than 0');
    if (!Number.isNaN(purchase) && !Number.isNaN(sold) && sold > purchase) err('units_sold', 'Units sold is greater than purchase quantity');
    if (!Number.isNaN(purchase) && !Number.isNaN(sold) && !Number.isNaN(waste) && waste > purchase - sold + 1e-9)
      warn('waste_quantity', 'Waste is greater than leftover (purchase − sold)');

    let shelf: number | null = null;
    if (raw.shelf_life_days?.trim()) {
      shelf = num(raw.shelf_life_days);
      if (Number.isNaN(shelf) || shelf <= 0 || shelf > 365) { err('shelf_life_days', 'Use a number of days between 1 and 365'); shelf = null; }
    } else warn('shelf_life_days', 'Missing — the category’s typical shelf life will be used');
    let temp: number | null = null;
    if (raw.storage_temperature?.trim()) {
      temp = num(raw.storage_temperature);
      if (Number.isNaN(temp) || temp < -40 || temp > 60) { err('storage_temperature', 'Temperature must be between −40 and 60 °C'); temp = null; }
    }

    const promoRaw = (raw.promotion ?? '').trim().toLowerCase();
    const promotion = ['1', 'true', 'yes', 'y'].includes(promoRaw) ? 1 : ['', '0', 'false', 'no', 'n'].includes(promoRaw) ? 0 : -1;
    if (promotion === -1) err('promotion', 'Use Yes/No or 1/0');

    const wRaw = (raw.weather ?? '').trim();
    const weather = wRaw ? weathers.get(wRaw.toLowerCase()) ?? null : null;
    if (wRaw && !weather) err('weather', `Use ${WEATHER.join(', ')}`);

    if (date && cat) {
      const key = `${date}|${cat}`;
      if (seen.has(key)) {
        err('date', `Duplicate of row ${seen.get(key)} (same date and category)`);
        duplicates++;
      } else seen.set(key, row);
      if (existingKeys.has(key)) warn('date', 'Already imported — this row will replace the existing record');
    }

    const ok = issues.filter((x) => x.severity === 'error').length === before;
    records.push(ok ? { date: date!, food_category: cat!, purchase_quantity: purchase, units_sold: sold, waste_quantity: waste, shelf_life_days: shelf,
      storage_temperature: temp, promotion, weather } : null);
  });

  const errorRows = new Set(issues.filter((x) => x.severity === 'error').map((x) => x.row)).size;
  return {
    columns: [...HISTORY_COLUMNS],
    rows: table,
    records,
    issues,
    missingColumns: [],
    summary: { total: table.length, valid: records.filter(Boolean).length, errorRows, warningCount: issues.filter((x) => x.severity === 'warning').length, duplicates },
  };
}

export function tableFromCsv(text: string, maxRows: number) {
  const grid = parseCsv(text, maxRows);
  if (!grid.length) return { header: [] as string[], table: [] as Record<string, string>[] };
  const header = grid[0].map((h) => {
    const k = h.trim().toLowerCase().replace(/\s+/g, '_');
    return COLUMN_ALIASES[k] ?? k;
  });
  const table = grid.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
  return { header, table };
}

export const TEMPLATE_CSV = toCsv(
  [...HISTORY_COLUMNS],
  [
    ['2026-09-01', 'Prepared Food', 120, 96, 9, 1, 19.5, 'No', 'Sunny'],
    ['2026-09-01', 'Bakery', 80, 71, 3, 3, 22, 'No', 'Sunny'],
    ['2026-09-02', 'Prepared Food', 125, 118, 2, 1, 20.1, 'Yes', 'Rainy'],
  ]
);
