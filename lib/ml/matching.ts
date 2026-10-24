import fs from 'fs';
import path from 'path';
import { predictProba, type ExportedModel } from './runtime';

/*
 * Feature 2 — donation ↔ organization success model, trained in ml/matching/02_matching_model.ipynb
 * on a SYNTHETIC dataset (clearly labelled). buildMatchFeatures() mirrors ml/matching/pipeline.py exactly.
 */

export type MatchArtifacts = {
  org_type_mode: string;
  acceptance_median: number;
  storage_mode_by_category: Record<string, string>;
  expiry_median_by_category: Record<string, number>;
  capacity_ratio_median: number;
  travel_intercept_min: number;
  distance_median: number;
};

export type MatchBundle = {
  version: string;
  trained_at: string;
  synthetic: boolean;
  dataset: { name: string; rows_raw: number; rows_clean: number; donations: number; organizations: number; success_rate: number };
  cleaning: Record<string, number>;
  leakage_columns_removed: string[];
  artifacts: MatchArtifacts;
  features: string[];
  algorithm: string;
  imbalance_strategy: string;
  model: ExportedModel;
  test: Record<string, number>;
  confusion_matrix: number[][];
  labels: string[];
  comparison_test: Record<string, string | number>[];
  comparison_val: Record<string, string | number>[];
  imbalance_comparison: Record<string, string | number>[];
  ranking_test: { method: string; top_pick_success_rate: number; donations: number }[];
  feature_importance: Record<string, number>;
};

export const AVG_SPEED_KMH = 18;
const CATS = ['Bakery', 'Dairy', 'Fruits', 'Meat', 'Prepared Food', 'Vegetables'];
const ORG_TYPES = ['NGO', 'Community Kitchen', 'Shelter', 'Food Bank', 'Orphanage'];
const STORAGE = ['Ambient', 'Refrigerated', 'Frozen'];
const BUSINESS = ['Cafeteria', 'Cloud Kitchen', 'Restaurant', 'Supermarket'];

const g = globalThis as unknown as { __matchModel?: MatchBundle | null; __matchModelErr?: string };

export function loadMatchModel(): MatchBundle | null {
  if (g.__matchModel !== undefined) return g.__matchModel;
  try {
    const b = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'lib', 'model', 'matching-model.json'), 'utf8')) as MatchBundle;
    if (!b.features?.length || !b.model) throw new Error('Model file is incomplete.');
    g.__matchModel = b;
  } catch (e) {
    g.__matchModel = null;
    g.__matchModelErr = e instanceof Error ? e.message : String(e);
    console.error('[ml] matching model unavailable:', g.__matchModelErr);
  }
  return g.__matchModel;
}
export const matchModelError = () => g.__matchModelErr ?? null;

export type MatchInput = {
  food_category: string;
  business_type: string;
  org_type: string | null;
  storage_required: string | null; // Ambient | Refrigerated | Frozen
  quantity_units: number;
  hours_to_expiry: number | null;
  daily_capacity_units: number;
  capacity_remaining_units: number | null;
  past_acceptance_rate: number | null;
  open_now: 0 | 1;
  hours_until_open: number;
  distance_km: number | null;
  travel_time_min: number | null;
  accepts_category: 0 | 1;
  has_required_storage: 0 | 1;
  posted_hour: number;
  day_of_week: number; // Monday = 0
};

export function buildMatchFeatures(i: MatchInput, a: MatchArtifacts): Record<string, number> {
  const orgType = i.org_type ?? a.org_type_mode;
  const acc = i.past_acceptance_rate ?? a.acceptance_median;
  const storage = i.storage_required ?? a.storage_mode_by_category[i.food_category];
  const hours = i.hours_to_expiry ?? a.expiry_median_by_category[i.food_category];
  const capRem = i.capacity_remaining_units ?? Math.round(i.daily_capacity_units * a.capacity_ratio_median);
  let dist = i.distance_km;
  if (dist == null && i.travel_time_min != null) dist = (Math.max(0, i.travel_time_min - a.travel_intercept_min) / 60) * AVG_SPEED_KMH;
  if (dist == null) dist = a.distance_median;
  const travel = i.travel_time_min ?? (dist / AVG_SPEED_KMH) * 60 + a.travel_intercept_min;
  const q = i.quantity_units;
  const arrival = i.hours_until_open + travel / 60;
  const f: Record<string, number> = {
    Quantity_Units: q,
    Quantity_Log: Math.log1p(q),
    Hours_To_Expiry: hours,
    Daily_Capacity_Units: i.daily_capacity_units,
    Capacity_Remaining_Units: capRem,
    Capacity_Ratio: Math.min(10, capRem / q),
    Past_Acceptance_Rate: acc,
    Open_Now: i.open_now,
    Hours_Until_Open: i.hours_until_open,
    Distance_km: dist,
    Travel_Time_min: travel,
    Arrival_Hours: arrival,
    Time_Slack_Hours: hours - arrival,
    Accepts_Category: i.accepts_category,
    Has_Required_Storage: i.has_required_storage,
    Posted_Hour: i.posted_hour,
    Is_Late_Evening: i.posted_hour >= 21 ? 1 : 0,
    Is_Weekend: i.day_of_week === 4 || i.day_of_week === 5 ? 1 : 0,
  };
  for (const t of ORG_TYPES) f[`Org_Type=${t}`] = orgType === t ? 1 : 0;
  for (const c of CATS) f[`Food_Category=${c}`] = i.food_category === c ? 1 : 0;
  for (const s of STORAGE) f[`Storage_Required=${s}`] = storage === s ? 1 : 0;
  for (const b of BUSINESS) f[`Business_Type=${b}`] = i.business_type === b ? 1 : 0;
  return f;
}

/** Probability (0–1) that offering this donation to this organization ends in a successful delivery. */
export function predictMatch(i: MatchInput, b = loadMatchModel()): number | null {
  if (!b) return null;
  const f = buildMatchFeatures(i, b.artifacts);
  const x = b.features.map((n) => f[n]);
  if (x.some((v) => v === undefined || Number.isNaN(v))) return null;
  const { classes, proba } = predictProba(b.model, x);
  const idx = classes.indexOf('1');
  return proba[idx >= 0 ? idx : proba.length - 1];
}
