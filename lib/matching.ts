import { getDb, nowIso } from './db';
import { haversineKm } from './areas';
import { parseOrg, type Org } from './orgs';
import type { Donation } from './donations';
import { MODEL_BUSINESS_TYPE, MODEL_ORG_TYPE } from './constants';
import { predictMatch } from './ml/matching';

/*
 * Matching = safety rules first, then AI ranking (PRD §12).
 * 1. Exclude unverified / suspended recipients.
 * 2. Exclude recipients that do not accept the category or cannot store the food.
 * 3. Exclude recipients that cannot receive before the safe-use deadline or have no capacity left.
 * 4. Rank the remaining candidates by the ML model's estimated probability of a successful delivery
 *    (ml/matching/02_matching_model.ipynb — trained on a clearly labelled SYNTHETIC dataset).
 *    If the model is unavailable, fall back to the transparent weighted rule score.
 * 5. Explain with the rule factors (capacity, distance, timing, need).
 */

export const WEIGHTS = { quantity: 0.3, distance: 0.3, timing: 0.2, need: 0.2 };
const MAX_USEFUL_KM = 15;
const AVG_SPEED_KMH = 18; // Dhaka city traffic, straight-line estimate

// Explicit unit rule for capacity checks (capacity is recorded in kg-equivalent).
export const KG_EQUIVALENT: Record<string, number> = { kg: 1, liters: 1, portions: 0.35, units: 0.5 };
// The matching model counts food in "units" (≈ 0.5 kg-eq each, same convention as the Kaggle dataset).
const toModelUnits = (kgEq: number) => kgEq / KG_EQUIVALENT.units;
export const toKgEq = (qty: number, unit: string) => qty * (KG_EQUIVALENT[unit] ?? 1);

export type MatchResult = {
  recipient_user_id: number;
  org: Pick<Org, 'id' | 'organization_name' | 'organization_type' | 'area' | 'receiving_capacity' | 'required_quantity' | 'operating_hours_open' | 'operating_hours_close'>;
  score: number;
  /** ML probability (0–1) of successful delivery; null when the model is unavailable. */
  ai_probability: number | null;
  score_source: 'ai' | 'rules';
  rule_score: number;
  distance_km: number | null;
  available_capacity: number;
  earliest_receive: string;
  factors: { quantity: number; distance: number; timing: number; need: number };
  explanation: string;
  request_status: string | null;
};

export type Exclusion = { organization_name: string; reason: string };

function dhakaMinutes(d: Date) {
  const local = new Date(d.getTime() + 6 * 3600_000);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}
const hm = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};

/** Earliest instant >= `from` that falls inside the recipient's daily receiving window (Dhaka time). */
export function earliestReceive(from: Date, open: string, close: string): Date {
  const o = hm(open);
  const c = hm(close);
  const cur = dhakaMinutes(from);
  if (cur >= o && cur < c) return from;
  const add = cur < o ? o - cur : 24 * 60 - cur + o;
  return new Date(from.getTime() + add * 60_000);
}

/** kg-equivalent already committed to this recipient today (accepted/scheduled/collected, not yet delivered). */
function committedLoad(recipientId: number) {
  const rows = getDb()
    .prepare(
      `SELECT d.quantity_available AS q, d.unit FROM donation_requests r JOIN donations d ON d.id = r.donation_id
       WHERE r.recipient_id = ? AND r.status = 'accepted' AND d.status IN ('accepted','scheduled','collected')`
    )
    .all(recipientId);
  return rows.reduce((s, r) => s + toKgEq(Number(r.q), String(r.unit)), 0);
}

const STORAGE_MODEL: Record<string, string> = { ambient: 'Ambient', refrigerated: 'Refrigerated', frozen: 'Frozen' };

function donorBusinessType(donorId: number): string {
  const r = getDb().prepare(`SELECT organization_type FROM organizations WHERE user_id = ?`).get(donorId);
  return MODEL_BUSINESS_TYPE[String(r?.organization_type ?? '')] ?? 'Restaurant';
}

/** Share of this recipient's past offers/requests that were accepted or completed (null if fewer than 3). */
function pastAcceptanceRate(recipientId: number): number | null {
  const r = getDb()
    .prepare(`SELECT COUNT(*) AS n, SUM(CASE WHEN status IN ('accepted','completed') THEN 1 ELSE 0 END) AS ok FROM donation_requests WHERE recipient_id = ?`)
    .get(recipientId);
  const n = Number(r?.n ?? 0);
  return n >= 3 ? Number(r!.ok) / n : null;
}

export function evaluate(d: Donation, org: Org, now = new Date()): { ok: true; match: MatchResult } | { ok: false; reason: string } {
  if (org.verification_status !== 'verified') return { ok: false, reason: 'Organization is not verified' };
  if (!org.accepted_categories.includes(d.food_category)) return { ok: false, reason: `Does not accept ${d.food_category}` };
  if (!org.storage_capabilities.includes(d.storage_requirement)) return { ok: false, reason: `No ${d.storage_requirement} storage` };

  const distance =
    d.latitude != null && d.longitude != null && org.latitude != null && org.longitude != null
      ? haversineKm(d.latitude, d.longitude, org.latitude, org.longitude)
      : null;
  const travelMs = ((distance ?? 8) / AVG_SPEED_KMH) * 3600_000;
  const start = new Date(Math.max(now.getTime(), Date.parse(d.available_from)));
  const receiveAt = earliestReceive(new Date(start.getTime() + travelMs), org.operating_hours_open, org.operating_hours_close);
  const deadline = Date.parse(d.safe_until);
  if (receiveAt.getTime() >= deadline) return { ok: false, reason: 'Cannot receive before the safe-use deadline' };

  const qtyKg = toKgEq(d.quantity_available, d.unit);
  const capacity = Math.max(0, org.receiving_capacity - committedLoad(org.user_id));
  if (capacity <= 0) return { ok: false, reason: 'No remaining receiving capacity today' };

  const f = {
    quantity: Math.min(1, capacity / qtyKg),
    distance: distance == null ? 0.5 : Math.max(0, 1 - distance / MAX_USEFUL_KM),
    timing: Math.max(0, Math.min(1, 1 - (receiveAt.getTime() - now.getTime()) / Math.max(1, deadline - now.getTime()))),
    need: org.required_quantity > 0 ? Math.min(1, org.required_quantity / qtyKg) : 0.3,
  };
  const ruleScore = Math.round(100 * (WEIGHTS.quantity * f.quantity + WEIGHTS.distance * f.distance + WEIGHTS.timing * f.timing + WEIGHTS.need * f.need));

  // AI ranking: probability that this offer ends in a successful delivery.
  const nowMin = dhakaMinutes(now);
  const openMin = hm(org.operating_hours_open);
  const closeMin = hm(org.operating_hours_close);
  const openNow = nowMin >= openMin && nowMin < closeMin;
  const posted = new Date(Date.parse(d.created_at || now.toISOString()) + 6 * 3600_000);
  let prob: number | null = null;
  try {
    prob = predictMatch({
      food_category: d.food_category,
      business_type: donorBusinessType(d.donor_id),
      org_type: MODEL_ORG_TYPE[org.organization_type] ?? null,
      storage_required: STORAGE_MODEL[d.storage_requirement] ?? null,
      quantity_units: Math.max(1, Math.round(toModelUnits(qtyKg))),
      hours_to_expiry: Math.max(0, (deadline - now.getTime()) / 3600_000),
      daily_capacity_units: Math.max(1, Math.round(toModelUnits(org.receiving_capacity))),
      capacity_remaining_units: Math.round(toModelUnits(capacity)),
      past_acceptance_rate: pastAcceptanceRate(org.user_id),
      open_now: openNow ? 1 : 0,
      hours_until_open: openNow ? 0 : ((openMin - nowMin + 1440) % 1440) / 60,
      distance_km: distance,
      travel_time_min: distance == null ? null : (distance / AVG_SPEED_KMH) * 60,
      accepts_category: 1,
      has_required_storage: 1,
      posted_hour: posted.getUTCHours(),
      day_of_week: (posted.getUTCDay() + 6) % 7,
    });
  } catch (e) {
    console.error('[matching] AI ranking failed, using rule score:', e);
  }
  const score = prob == null ? ruleScore : Math.round(prob * 100);

  const reasons: string[] = [`accepts ${d.food_category.toLowerCase()}`];
  reasons.push(f.quantity >= 1 ? 'has sufficient capacity' : `can take about ${Math.round(capacity)} of ${Math.round(qtyKg)} kg-eq`);
  if (distance != null) reasons.push(distance < 3 ? `is close by (~${distance.toFixed(1)} km)` : `is ~${distance.toFixed(1)} km away`);
  reasons.push(receiveAt.getTime() <= start.getTime() + travelMs + 60_000 ? 'can receive now' : `can receive from ${receiveAt.toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit' })}`);
  const lead = prob == null ? '' : `AI estimates a ${Math.round(prob * 100)}% chance of successful delivery. `;
  const explanation = `${lead}Recommended because the organization ${reasons.slice(0, -1).join(', ')} and ${reasons[reasons.length - 1]}, within the stated time window.`;

  return {
    ok: true,
    match: {
      recipient_user_id: org.user_id,
      org: {
        id: org.id,
        organization_name: org.organization_name,
        organization_type: org.organization_type,
        area: org.area,
        receiving_capacity: org.receiving_capacity,
        required_quantity: org.required_quantity,
        operating_hours_open: org.operating_hours_open,
        operating_hours_close: org.operating_hours_close,
      },
      score,
      ai_probability: prob == null ? null : Math.round(prob * 1000) / 1000,
      score_source: prob == null ? 'rules' : 'ai',
      rule_score: ruleScore,
      distance_km: distance == null ? null : Math.round(distance * 10) / 10,
      available_capacity: Math.round(capacity * 10) / 10,
      earliest_receive: receiveAt.toISOString(),
      factors: {
        quantity: Math.round(f.quantity * 100) / 100,
        distance: Math.round(f.distance * 100) / 100,
        timing: Math.round(f.timing * 100) / 100,
        need: Math.round(f.need * 100) / 100,
      },
      explanation,
      request_status: null,
    },
  };
}

/** Ranked recipients for one donation, plus a list of exclusions with reasons. Persists to donation_matches. */
export function matchesForDonation(d: Donation, persist = true) {
  const db = getDb();
  const orgs = db
    .prepare(
      `SELECT o.* FROM organizations o JOIN users u ON u.id = o.user_id
       WHERE o.kind = 'recipient' AND u.account_status = 'active'`
    )
    .all()
    .map((r) => parseOrg(r)!);
  const reqs = new Map<number, string>(
    db.prepare('SELECT recipient_id, status FROM donation_requests WHERE donation_id = ?').all(d.id).map((r) => [Number(r.recipient_id), String(r.status)])
  );
  const matches: MatchResult[] = [];
  const excluded: Exclusion[] = [];
  for (const org of orgs) {
    const r = evaluate(d, org);
    if (r.ok) matches.push({ ...r.match, request_status: reqs.get(org.user_id) ?? null });
    else excluded.push({ organization_name: org.organization_name, reason: r.reason });
  }
  matches.sort((a, b) => b.score - a.score || (a.distance_km ?? 99) - (b.distance_km ?? 99));
  if (persist && ['available', 'requested'].includes(d.status)) {
    const up = db.prepare(
      `INSERT INTO donation_matches (donation_id, recipient_id, compatibility_score, explanation, distance_estimate, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(donation_id, recipient_id) DO UPDATE SET compatibility_score = excluded.compatibility_score,
         explanation = excluded.explanation, distance_estimate = excluded.distance_estimate, created_at = excluded.created_at`
    );
    for (const m of matches) up.run(d.id, m.recipient_user_id, m.score, m.explanation, m.distance_km, nowIso());
  }
  return { matches, excluded };
}

/** Ranked available donations for a recipient organization (recipient "Recommended Matches"). */
export function recommendationsForRecipient(org: Org, donations: Donation[]) {
  const declined = new Set(
    getDb()
      .prepare(`SELECT donation_id FROM donation_matches WHERE recipient_id = ? AND status = 'declined'`)
      .all(org.user_id)
      .map((r) => Number(r.donation_id))
  );
  const out: { donation: Donation; match: MatchResult }[] = [];
  for (const d of donations) {
    if (declined.has(d.id)) continue;
    const r = evaluate(d, org);
    if (r.ok) out.push({ donation: d, match: r.match });
  }
  // Prioritise suitability and urgency, not just proximity.
  out.sort((a, b) => b.match.score - a.match.score || Date.parse(a.donation.safe_until) - Date.parse(b.donation.safe_until));
  return out;
}
