#!/usr/bin/env node
/**
 * foodloop-forecast-mcp — FoodLoop's two ML models as MCP tools (stdio).
 * Uses exactly the same model files (lib/model/*.json), TypeScript inference and matching rules as the web app.
 *   predict_leftover      how many units will be left over, with an 80% range and plain-language reasons
 *   predict_waste_risk    Low / Medium / High waste risk with probabilities
 *   rank_organizations    safety rules first, then AI-ranked recipient organizations (from the local app database)
 *   get_model_metrics     test metrics of both models
 * Run: npx tsx mcp/forecast-server.ts
 */
import { ROOT, fail, json, log, tools } from './shared';
import fs from 'fs';
import path from 'path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { BUSINESS_TYPES, FOOD_CATEGORIES, MODEL_BUSINESS_TYPE, STORAGE, UNITS, WEATHER } from '../lib/constants';
import { loadWasteModel, predictWaste } from '../lib/ml/waste';
import { loadMatchModel } from '../lib/ml/matching';

const server = new McpServer({ name: 'foodloop-forecast-mcp', version: '1.0.0' });
const RO = { readOnlyHint: true, openWorldHint: false };
const tool = tools(server);

const forecastInput = {
  food_category: z.enum(FOOD_CATEGORIES).describe('Food category'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Day of the forecast, YYYY-MM-DD'),
  purchase_quantity: z.number().positive().max(100000).describe('Units bought or prepared for the day'),
  business_type: z.enum(BUSINESS_TYPES).default('Restaurant').describe('Donor business type'),
  weather: z.enum(WEATHER).optional().describe('Weather (leave out for a typical day)'),
  promotion: z.boolean().default(false).describe('Is a promotion running?'),
  shelf_life_days: z.number().positive().max(365).optional(),
  storage_temperature: z.number().min(-30).max(40).optional().describe('°C'),
};
type ForecastArgs = { food_category: string; date: string; purchase_quantity: number; business_type: string; weather?: string; promotion: boolean;
  shelf_life_days?: number; storage_temperature?: number };

function forecast(a: ForecastArgs) {
  if (!loadWasteModel()) throw new Error('Waste model file lib/model/waste-models.json is missing.');
  return predictWaste({
    date: a.date, business_type: MODEL_BUSINESS_TYPE[a.business_type] ?? 'Restaurant', food_category: a.food_category,
    purchase_quantity: a.purchase_quantity, shelf_life_days: a.shelf_life_days ?? null, storage_temperature: a.storage_temperature ?? null,
    promotion: a.promotion, weather: a.weather ?? null,
  });
}

tool('predict_leftover', {
  title: 'Predict leftover food',
  description: 'Estimate how many units of a food category will be left over at the end of a day, with an 80% range and the main reasons. Same model as the FoodLoop web app (Gradient Boosting, test MAE 7.8 units). Always an estimate.',
  inputSchema: forecastInput,
  annotations: RO,
}, async (a) => {
  try {
    const p = forecast(a as ForecastArgs);
    return json({ leftover_units: p.leftover, range_80: [p.lower, p.upper], expected_sales: p.demand, typical_demand: p.expected_demand,
      inputs_used: p.inputs, reasons: p.factors, note: 'Estimate only. Confirm the real quantity before creating a donation.' });
  } catch (e) { return fail((e as Error).message); }
});

tool('predict_waste_risk', {
  title: 'Predict waste risk',
  description: 'Classify the waste risk of a food category for a day as Low, Medium or High with probabilities (Random Forest, test accuracy 71.2%).',
  inputSchema: forecastInput,
  annotations: RO,
}, async (a) => {
  try {
    const p = forecast(a as ForecastArgs);
    return json({ waste_risk: p.waste_level, probabilities: p.probabilities, reasons: p.factors });
  } catch (e) { return fail((e as Error).message); }
});

tool('rank_organizations', {
  title: 'Rank recipient organizations',
  description: 'For a surplus donation, apply FoodLoop safety rules (verified, accepts the category, has the storage, can receive before the deadline, has capacity) and rank the eligible organizations by the AI matching model. Reads organizations from the local FoodLoop database; nothing is saved.',
  inputSchema: {
    food_category: z.enum(FOOD_CATEGORIES),
    quantity: z.number().positive().max(100000),
    unit: z.enum(UNITS).default('portions'),
    storage_requirement: z.enum(STORAGE).default('ambient'),
    hours_until_deadline: z.number().positive().max(240).default(6).describe('Hours until the safe-use deadline'),
    ready_in_minutes: z.number().min(0).max(1440).default(0),
    latitude: z.number().min(-90).max(90).optional().describe('Pickup location (default: central Dhaka)'),
    longitude: z.number().min(-180).max(180).optional(),
    business_type: z.enum(BUSINESS_TYPES).default('Restaurant'),
    top: z.number().int().min(1).max(20).default(5),
  },
  annotations: RO,
}, async (a) => {
  try {
    if (!loadMatchModel()) log('matching model missing: rule-based scores only');
    const { getDb, nowIso } = await import('../lib/db');
    const { matchesForDonation } = await import('../lib/matching');
    const db = getDb();
    const donor = db.prepare(`SELECT o.user_id FROM organizations o WHERE o.kind = 'donor' AND o.organization_type = ? LIMIT 1`).get(a.business_type)
      ?? db.prepare(`SELECT o.user_id FROM organizations o WHERE o.kind = 'donor' LIMIT 1`).get();
    const now = Date.now();
    const d = {
      id: 0, donor_id: Number(donor?.user_id ?? 0), item_name: 'MCP query', food_category: a.food_category, description: null,
      quantity_available: a.quantity, unit: a.unit, prepared_at: null, available_from: new Date(now + a.ready_in_minutes * 60_000).toISOString(),
      safe_until: new Date(now + a.hours_until_deadline * 3600_000).toISOString(), storage_requirement: a.storage_requirement,
      pickup_address: 'not shared', area: null, latitude: a.latitude ?? 23.7808, longitude: a.longitude ?? 90.4067, packaging: null, allergens: null,
      handling_instructions: null, contact_method: null, notes: null, forecast_id: null, status: 'available' as const, created_at: nowIso(), updated_at: nowIso(),
    };
    const { matches, excluded } = matchesForDonation(d, false);
    return json({
      eligible: matches.length,
      ranked: matches.slice(0, a.top).map((m, i) => ({ rank: i + 1, organization: m.org.organization_name, type: m.org.organization_type, area: m.org.area, score: m.score,
        ai_success_probability: m.ai_probability, distance_km: m.distance_km, why: m.explanation })),
      excluded: excluded.map((x) => ({ organization: x.organization_name, reason: x.reason })),
      note: 'Safety rules run before AI ranking. A person always confirms the donation.',
    });
  } catch (e) { return fail((e as Error).message); }
});

tool('get_model_metrics', {
  title: 'Model metrics',
  description: 'Test-set metrics of FoodLoop\'s leftover regressor, waste-risk classifier and matching classifier, with their baselines.',
  annotations: RO,
}, async () => {
  const read = (p: string) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
  try {
    return json({ waste: read('ml/waste/reports/metrics_summary.json'), matching: read('ml/matching/reports/metrics_summary.json') });
  } catch (e) { return fail((e as Error).message); }
});

server.connect(new StdioServerTransport()).then(() => log('foodloop-forecast-mcp ready on stdio'));
