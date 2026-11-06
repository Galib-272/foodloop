import { z } from 'zod';
import { FOOD_CATEGORIES, STORAGE, UNITS } from './constants';

/**
 * AI extraction: turn one sentence from a donor ("20 boxes of chicken biryani, ready at 8pm, good until 11pm, contains nuts")
 * into donation-form fields.
 *   1. A local LLM through Ollama (OLLAMA_URL) with a JSON schema in `format` (structured output), validated with Zod.
 *   2. Otherwise, or if the model's JSON is invalid, a rule-based parser (also used on the live site).
 * Phone numbers and e-mail addresses are removed before any text goes to a model. Nothing is published:
 * the donor reviews every field and must still set a verified safe-use deadline.
 */

export type Extracted = {
  item_name?: string;
  food_category?: (typeof FOOD_CATEGORIES)[number];
  quantity_available?: number;
  unit?: (typeof UNITS)[number];
  storage_requirement?: (typeof STORAGE)[number];
  available_from?: string; // ISO
  safe_until?: string; // ISO
  allergens?: string;
  packaging?: string;
  description?: string;
};
export type ExtractResult = { fields: Extracted; source: string; missing: string[]; notes: string[] };

const REQUIRED: (keyof Extracted)[] = ['item_name', 'food_category', 'quantity_available', 'unit', 'storage_requirement', 'available_from', 'safe_until'];

export function scrub(text: string) {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email removed]')
    .replace(/(\+?88)?0?1[3-9]\d{2}[-\s]?\d{6}\b/g, '[phone removed]')
    .replace(/\+?\d[\d\s-]{8,}\d/g, '[phone removed]');
}

// ---------- rule-based parser ----------
const CATEGORY_WORDS: [(typeof FOOD_CATEGORIES)[number], RegExp][] = [
  ['Prepared Food', /\b(biryani|khichuri|khichdi|polao|pulao|rice|curry|dal|daal|meal|meals|lunch|dinner|cooked|bhuna|korma|haleem|noodles?|pasta|soup|tehari|kebab|sandwich(es)?)\b/i],
  ['Bakery', /\b(bread|breads|bun|buns|cake|cakes|pastr(y|ies)|roti|rotis|paratha|parathas|croissants?|biscuits?|cookies?|muffins?|naan)\b/i],
  ['Dairy', /\b(milk|yog(h)?urt|doi|cheese|paneer|butter|ghee|cream|lassi)\b/i],
  ['Meat', /\b(raw )?(chicken|beef|mutton|goat|lamb|fish|prawns?|shrimps?|meat)\b/i],
  ['Fruits', /\b(fruits?|apples?|bananas?|mangoes|mangos?|oranges?|grapes?|guavas?|papayas?|pineapples?|watermelons?|lychees?|dates)\b/i],
  ['Vegetables', /\b(vegetables?|veg|potato(es)?|tomato(es)?|onions?|carrots?|cabbages?|cauliflowers?|spinach|brinjals?|eggplants?|sobji|shak|cucumbers?|beans|lentils?)\b/i],
];
const UNIT_WORDS: [(typeof UNITS)[number], RegExp][] = [
  ['kg', /^(kg|kgs|kilo|kilos|kilograms?)$/i],
  ['liters', /^(l|ltr|liters?|litres?)$/i],
  ['portions', /^(portions?|plates?|servings?|meals?|packets? of meal)$/i],
  ['units', /^(units?|pieces?|pcs|boxes|box|packs?|packets?|trays?|loaves|loaf|bottles?|cartons?|dozen)$/i],
];
const ALLERGENS = ['nuts', 'peanut', 'milk', 'dairy', 'egg', 'gluten', 'wheat', 'soy', 'fish', 'shellfish', 'sesame'];

function atTime(base: Date, h: number, m: number) {
  // Times are Dhaka local (UTC+6, no DST).
  const d = new Date(base.getTime() + 6 * 3600_000);
  d.setUTCHours(h, m, 0, 0);
  let t = d.getTime() - 6 * 3600_000;
  if (t < base.getTime() - 3600_000) t += 24 * 3600_000; // a time earlier than now means tomorrow
  return new Date(t).toISOString();
}

function parseTime(s: string): [number, number] | null {
  const m = s.match(/(\d{1,2})(?::|\.)?(\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const ap = m[3]?.toLowerCase().replace(/\./g, '');
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  if (!ap && !m[2] && h < 7) h += 12; // "ready at 8" in an evening context
  return h < 24 && min < 60 ? [h, min] : null;
}

export function ruleExtract(raw: string, now = new Date()): Extracted {
  const text = raw.replace(/\s+/g, ' ').trim();
  const out: Extracted = {};
  const qty = text.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?/);
  if (qty) {
    out.quantity_available = Number(qty[1]);
    const word = qty[2] ?? '';
    out.unit = UNIT_WORDS.find(([, re]) => re.test(word))?.[0] ?? (/\b(people|persons?)\b/i.test(text) ? 'portions' : 'units');
  }
  const cat = CATEGORY_WORDS.find(([, re]) => re.test(text));
  if (cat) out.food_category = cat[0];
  if (/\b(frozen|freezer)\b/i.test(text)) out.storage_requirement = 'frozen';
  else if (/\b(fridge|refrigerat\w*|chilled|cold)\b/i.test(text)) out.storage_requirement = 'refrigerated';
  else if (out.food_category === 'Dairy' || (out.food_category === 'Meat' && !/cooked/i.test(text))) out.storage_requirement = 'refrigerated';
  else if (out.food_category) out.storage_requirement = 'ambient';

  const from = text.match(/\b(?:ready|available|pick(?:\s|-)?up)\s*(?:by|at|from|after)?\s*(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?)/i);
  const rest = from ? text.replace(from[0], ' ') : text; // the deadline is searched in what is left after the ready time
  const until = rest.match(/\b(?:until|till|before|by|good until|safe until|use by|expires?(?: at)?)\s*(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?)/i);
  const tf = from && parseTime(from[1]);
  if (tf) out.available_from = atTime(now, tf[0], tf[1]);
  const tu = until && parseTime(until[1]);
  if (tu) {
    let iso = atTime(now, tu[0], tu[1]);
    if (out.available_from && Date.parse(iso) <= Date.parse(out.available_from)) iso = new Date(Date.parse(iso) + 24 * 3600_000).toISOString();
    out.safe_until = iso;
  }
  if (!out.available_from && out.safe_until) out.available_from = new Date(Math.ceil(now.getTime() / 900_000) * 900_000).toISOString();

  const found = ALLERGENS.filter((a) => new RegExp(`\\b${a}s?\\b`, 'i').test(text));
  if (found.length) out.allergens = Array.from(new Set(found.map((a) => (a === 'peanut' ? 'nuts' : a === 'dairy' ? 'milk' : a)))).join(', ');
  const pack = text.match(/\b(boxes|box|containers?|foil (?:trays?|containers?)|trays?|bags?|packets?|bottles?|cartons?)\b/i);
  if (pack) out.packaging = pack[1][0].toUpperCase() + pack[1].slice(1).toLowerCase();

  // item name: the food phrase after the quantity ("20 boxes of chicken biryani, ..." -> "Chicken biryani")
  let name = text.replace(/^(we have|we've got|there (is|are)|i have|we can give|we can donate)\s+/i, '')
    .split(/[,;]|\.\s| ready | available | good until | until | before | pick ?up | contains? | has | in the (?:fridge|freezer)| for \d+ (?:people|persons)/i)[0];
  name = name.replace(/^\s*\d+(?:\.\d+)?\s*[a-zA-Z]*\s*(of\s+)?/, '').trim();
  if (UNIT_WORDS.some(([, re]) => re.test(name.split(' ')[0] ?? ''))) name = name.split(' ').slice(1).join(' ').replace(/^of\s+/i, '');
  if (name.length >= 2) out.item_name = name[0].toUpperCase() + name.slice(1, 120);
  out.description = raw.trim().slice(0, 300);
  return out;
}

// ---------- LLM with structured output ----------
const llmSchema = z.object({
  item_name: z.string().min(2).max(120).nullable().optional(),
  food_category: z.enum(FOOD_CATEGORIES).nullable().optional(),
  quantity: z.number().positive().max(100000).nullable().optional(),
  unit: z.enum(UNITS).nullable().optional(),
  storage: z.enum(STORAGE).nullable().optional(),
  ready_time_24h: z.string().regex(/^\d{1,2}:\d{2}$/).nullable().optional(),
  safe_until_time_24h: z.string().regex(/^\d{1,2}:\d{2}$/).nullable().optional(),
  allergens: z.array(z.string().max(30)).max(10).nullable().optional(),
  packaging: z.string().max(100).nullable().optional(),
});

export const JSON_SCHEMA = {
  type: 'object',
  properties: {
    item_name: { type: ['string', 'null'] },
    food_category: { type: ['string', 'null'], enum: [...FOOD_CATEGORIES, null] },
    quantity: { type: ['number', 'null'] },
    unit: { type: ['string', 'null'], enum: [...UNITS, null] },
    storage: { type: ['string', 'null'], enum: [...STORAGE, null] },
    ready_time_24h: { type: ['string', 'null'] },
    safe_until_time_24h: { type: ['string', 'null'] },
    allergens: { type: ['array', 'null'], items: { type: 'string' } },
    packaging: { type: ['string', 'null'] },
  },
  required: ['item_name', 'food_category', 'quantity', 'unit', 'storage', 'ready_time_24h', 'safe_until_time_24h', 'allergens', 'packaging'],
};

const PROMPT = `Extract a food donation from the text. Return JSON only, matching the schema.
food_category must be one of: ${FOOD_CATEGORIES.join(', ')} (cooked dishes such as biryani are "Prepared Food").
unit must be one of: ${UNITS.join(', ')}. storage must be one of: ${STORAGE.join(', ')}.
Times are local 24-hour "HH:MM". Use null for anything the text does not say. Do not guess a safe-use time.`;

async function llmExtract(text: string, now: Date): Promise<{ fields: Extracted; model: string } | null> {
  const url = process.env.OLLAMA_URL;
  if (!url) return null;
  const model = process.env.OLLAMA_EXTRACT_MODEL || process.env.OLLAMA_SMALL_MODEL || 'qwen2.5:1.5b';
  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, stream: false, format: JSON_SCHEMA, options: { temperature: 0, seed: 7 },
        messages: [{ role: 'system', content: PROMPT }, { role: 'user', content: text }] }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!r.ok) return null;
    const content = ((await r.json()) as { message?: { content?: string } }).message?.content ?? '';
    const parsed = llmSchema.safeParse(JSON.parse(content));
    if (!parsed.success) return null;
    const p = parsed.data;
    const f: Extracted = {};
    if (p.item_name) f.item_name = p.item_name;
    if (p.food_category) f.food_category = p.food_category;
    if (p.quantity) f.quantity_available = p.quantity;
    if (p.unit) f.unit = p.unit;
    if (p.storage) f.storage_requirement = p.storage;
    const t = (s?: string | null) => { const m = s?.match(/^(\d{1,2}):(\d{2})$/); return m ? atTime(now, Number(m[1]), Number(m[2])) : undefined; };
    f.available_from = t(p.ready_time_24h);
    f.safe_until = t(p.safe_until_time_24h);
    if (f.available_from && f.safe_until && Date.parse(f.safe_until) <= Date.parse(f.available_from)) {
      f.safe_until = new Date(Date.parse(f.safe_until) + 24 * 3600_000).toISOString();
    }
    if (p.allergens?.length) f.allergens = p.allergens.join(', ');
    if (p.packaging) f.packaging = p.packaging;
    return { fields: f, model };
  } catch {
    return null;
  }
}

export async function extractDonation(raw: string, now = new Date()): Promise<ExtractResult> {
  const text = scrub(raw);
  const notes: string[] = [];
  if (text !== raw) notes.push('Contact details were removed before processing.');
  const rules = ruleExtract(text, now);
  const llm = await llmExtract(text, now);
  const fields: Extracted = { ...rules };
  let source = 'rules';
  if (llm) {
    source = `ollama:${llm.model}`;
    for (const [k, v] of Object.entries(llm.fields)) if (v !== undefined && v !== null && v !== '') (fields as Record<string, unknown>)[k] = v;
  } else if (process.env.OLLAMA_URL) {
    notes.push('The local model did not return valid JSON, so the rule-based parser was used.');
  }
  for (const k of Object.keys(fields) as (keyof Extracted)[]) if (fields[k] === undefined) delete fields[k];
  const missing = REQUIRED.filter((k) => fields[k] === undefined);
  if (!fields.safe_until) notes.push('Set the safe-use deadline yourself: it must be a time you have verified.');
  notes.push('Check every field before publishing. AI never publishes a donation by itself.');
  return { fields, source, missing, notes };
}
