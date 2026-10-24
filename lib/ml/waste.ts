import fs from 'fs';
import path from 'path';
import { predictProba, predictValue, type ExportedModel } from './runtime';

/*
 * Feature 1 — leftover prediction, trained in ml/waste/01_waste_model.ipynb on the Kaggle food-waste dataset.
 * buildWasteFeatures() mirrors ml/waste/pipeline.py:build_features() exactly (see lib/model/waste-golden.json).
 */

export type WasteArtifacts = {
  shelf_life_median: Record<string, number>;
  storage_temp_median: Record<string, number>;
  weather_mode: string;
  exp_demand_k1: Record<string, number>;
  exp_demand_k2: Record<string, number>;
  exp_demand_global: number;
  /** Share of leftover food that usually spoils, learned from past (training) days. */
  spoilage: { global: number; category: Record<string, number>; temp: Record<string, number>; weather: Record<string, number>; category_shelf: Record<string, number> };
};

// Must match SHELF_EDGES / TEMP_EDGES in ml/waste/pipeline.py
const SHELF_EDGES = [1, 2, 3, 5, 7];
const TEMP_EDGES = [4, 8, 15, 22];
const bucket = (v: number, edges: number[]) => edges.filter((e) => e < v).length;

type Metric = Record<string, number>;
export type WasteBundle = {
  version: string;
  trained_at: string;
  dataset: { name: string; rows_raw: number; rows_clean: number; period: string; split: Record<string, [string, string, number]> };
  prediction_time: string;
  leakage_columns_removed: string[];
  cleaning: Record<string, number>;
  artifacts: WasteArtifacts;
  features: string[];
  leftover: {
    approach: string; algorithm: string; model: ExportedModel; interval: { level: number; q_low: number; q_high: number };
    test: Metric; comparison_test: Record<string, string | number>[]; comparison_val: Record<string, string | number>[];
  };
  waste_level: {
    algorithm: string; imbalance_strategy: string; model: ExportedModel; labels: string[]; classes: string[]; test: Metric;
    confusion_matrix: number[][]; report: Record<string, Record<string, number> | number>;
    comparison_test: Record<string, string | number>[]; comparison_val: Record<string, string | number>[];
    imbalance_comparison: Record<string, string | number>[]; feature_importance: Record<string, number>;
  };
};

export const MODEL_CATEGORIES = ['Bakery', 'Dairy', 'Fruits', 'Meat', 'Prepared Food', 'Vegetables'] as const;
export const MODEL_BUSINESS_TYPES = ['Cafeteria', 'Cloud Kitchen', 'Restaurant', 'Supermarket'] as const;
export const MODEL_WEATHER = ['Cloudy', 'Hot', 'Rainy', 'Sunny'] as const;
const SEASONS = ['Winter', 'Summer', 'Monsoon', 'Autumn'] as const;

const g = globalThis as unknown as { __wasteModel?: WasteBundle | null; __wasteModelErr?: string };

export function loadWasteModel(): WasteBundle | null {
  if (g.__wasteModel !== undefined) return g.__wasteModel;
  try {
    const b = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'lib', 'model', 'waste-models.json'), 'utf8')) as WasteBundle;
    if (!b.features?.length || !b.leftover?.model || !b.waste_level?.model) throw new Error('Model file is incomplete.');
    g.__wasteModel = b;
  } catch (e) {
    g.__wasteModel = null;
    g.__wasteModelErr = e instanceof Error ? e.message : String(e);
    console.error('[ml] waste model unavailable:', g.__wasteModelErr);
  }
  return g.__wasteModel;
}
export const wasteModelError = () => g.__wasteModelErr ?? null;

export type WasteInput = {
  date: string; // YYYY-MM-DD
  business_type: string; // one of MODEL_BUSINESS_TYPES
  food_category: string; // one of MODEL_CATEGORIES
  purchase_quantity: number;
  shelf_life_days?: number | null;
  storage_temperature?: number | null;
  promotion: 0 | 1 | boolean;
  weather?: string | null;
};

function season(month: number) {
  return [12, 1, 2].includes(month) ? 'Winter' : [3, 4, 5].includes(month) ? 'Summer' : [6, 7, 8, 9].includes(month) ? 'Monsoon' : 'Autumn';
}

export function buildWasteFeatures(inp: WasteInput, a: WasteArtifacts) {
  const cat = inp.food_category;
  const weather = inp.weather || a.weather_mode;
  const promo = inp.promotion ? 1 : 0;
  const purchase = Number(inp.purchase_quantity);
  const shelf = inp.shelf_life_days ?? a.shelf_life_median[cat];
  const temp = inp.storage_temperature ?? a.storage_temp_median[cat];
  const d = new Date(inp.date + 'T00:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0 (pandas)
  const month = d.getUTCMonth() + 1;
  const k1 = `${inp.business_type}|${cat}|${promo}|${weather}`;
  const k2 = `${inp.business_type}|${cat}`;
  const exp = a.exp_demand_k1[k1] ?? a.exp_demand_k2[k2] ?? a.exp_demand_global;
  const f: Record<string, number> = {
    Purchase_Quantity: purchase,
    Purchase_Log: Math.log1p(purchase),
    Shelf_Life_Days: shelf,
    Storage_Temperature: temp,
    Temp_Deviation: temp - a.storage_temp_median[cat],
    Promotion: promo,
    Day_Of_Week: dow,
    Is_Weekend: dow === 4 || dow === 5 ? 1 : 0,
    Month: month,
    Expected_Demand: exp,
    Expected_Leftover: Math.max(0, purchase - exp),
    Overstock_Ratio: purchase / exp,
  };
  // Spoilage features: waste share ≈ (share left over) × (share of leftovers that spoil)
  const sp = a.spoilage;
  const g = sp.global;
  const catRate = sp.category[cat] ?? g;
  const catShelf = sp.category_shelf[`${cat}|${bucket(shelf, SHELF_EDGES)}`] ?? catRate;
  const tempRate = sp.temp[String(bucket(temp, TEMP_EDGES))] ?? g;
  const weatherRate = sp.weather[weather] ?? g;
  f.Leftover_Ratio_Exp = f.Expected_Leftover / purchase;
  f.Spoil_Rate_Est = catShelf * (tempRate / g) * (weatherRate / g);
  f.Waste_Ratio_Est = f.Leftover_Ratio_Exp * f.Spoil_Rate_Est;
  f.Waste_Units_Est = f.Expected_Leftover * f.Spoil_Rate_Est;
  f.Inv_Shelf_Life = 1 / shelf;
  for (const b of MODEL_BUSINESS_TYPES) f[`Business_Type=${b}`] = inp.business_type === b ? 1 : 0;
  for (const c of MODEL_CATEGORIES) f[`Food_Category=${c}`] = cat === c ? 1 : 0;
  for (const w of MODEL_WEATHER) f[`Weather=${w}`] = weather === w ? 1 : 0;
  for (const s of SEASONS) f[`Season=${s}`] = season(month) === s ? 1 : 0;
  return { named: f, weather, shelf, temp, exp };
}

export type WastePrediction = {
  demand: number;
  leftover: number;
  lower: number;
  upper: number;
  waste_level: 'Low' | 'Medium' | 'High';
  probabilities: Record<string, number>;
  expected_demand: number;
  inputs: { shelf_life_days: number; storage_temperature: number; weather: string };
  factors: string[];
};

export function predictWaste(inp: WasteInput, b = loadWasteModel()): WastePrediction {
  if (!b) throw new Error('Waste model unavailable');
  const { named, weather, shelf, temp, exp } = buildWasteFeatures(inp, b.artifacts);
  const x = b.features.map((name) => {
    const v = named[name];
    if (v === undefined || Number.isNaN(v)) throw new Error(`Missing feature ${name}`);
    return v;
  });
  const demand = predictValue(b.leftover.model, x);
  const leftover = Math.max(0, inp.purchase_quantity - demand);
  const { q_low, q_high } = b.leftover.interval;
  const { classes, proba } = predictProba(b.waste_level.model, x);
  const probabilities: Record<string, number> = {};
  classes.forEach((c, i) => (probabilities[c] = proba[i]));
  const level = classes[proba.indexOf(Math.max(...proba))] as WastePrediction['waste_level'];
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return {
    demand: r1(demand),
    leftover: r1(leftover),
    lower: r1(Math.max(0, leftover + q_low)),
    upper: r1(Math.min(inp.purchase_quantity, leftover + q_high)),
    waste_level: level,
    probabilities,
    expected_demand: r1(exp),
    inputs: { shelf_life_days: shelf, storage_temperature: temp, weather },
    factors: explain(inp, named, b.artifacts, demand),
  };
}

function explain(inp: WasteInput, f: Record<string, number>, a: WasteArtifacts, demand: number): string[] {
  const out: string[] = [];
  const ratio = f.Overstock_Ratio;
  if (ratio > 1.15) out.push(`Planned purchase is ${Math.round((ratio - 1) * 100)}% above typical demand for this business and food.`);
  else if (ratio < 0.95) out.push('Planned purchase is below typical demand, so little or nothing should be left over.');
  else out.push('Planned purchase is close to typical demand.');
  const base = a.exp_demand_k2[`${inp.business_type}|${inp.food_category}`];
  if (base && Math.abs(f.Expected_Demand - base) / base > 0.05) {
    out.push(`${inp.promotion ? 'The promotion' : 'The weather'} usually ${f.Expected_Demand > base ? 'raises' : 'lowers'} demand (about ${Math.round(Math.abs(f.Expected_Demand - base))} units vs a normal day).`);
  }
  if (f.Temp_Deviation > 3) out.push(`Storage is ${f.Temp_Deviation.toFixed(1)}°C warmer than normal for ${inp.food_category.toLowerCase()} — a storage-related waste risk.`);
  if (f.Shelf_Life_Days <= 2) out.push(`Short shelf life (${f.Shelf_Life_Days} day${f.Shelf_Life_Days === 1 ? '' : 's'}): leftovers must be donated quickly.`);
  out.push(`The model expects demand of about ${Math.round(demand)} units.`);
  return out;
}
