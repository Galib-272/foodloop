import { getDb } from './db';

/*
 * Metric definitions (PRD §16.4)
 * - Food rescued: quantity CONFIRMED as delivered by the recipient (collections.quantity_delivered).
 * - Completed donations: donations whose delivery has been confirmed (status = delivered).
 * - Fulfillment rate: delivered ÷ accepted requests whose donation reached a final outcome
 *   (delivered, failed, cancelled or expired). In-progress collections are excluded from the denominator.
 * - Recorded food waste: quantity reported as wasted in imported history and inventory.
 * Quantities are always grouped by unit; kg, liters and portions are never added together.
 */

export type UnitTotals = Record<string, number>;

export function formatTotals(t: UnitTotals, empty = '0 kg'): string {
  const parts = Object.entries(t)
    .filter(([, v]) => v > 0)
    .sort(([a], [b]) => (a === 'kg' ? -1 : b === 'kg' ? 1 : a.localeCompare(b)))
    .map(([u, v]) => `${Math.round(v * 10) / 10} ${u === 'liters' ? 'L' : u}`);
  return parts.length ? parts.join(' · ') : empty;
}

function totals(rows: { unit: string; q: number }[]): UnitTotals {
  const out: UnitTotals = {};
  for (const r of rows) out[r.unit] = (out[r.unit] ?? 0) + Number(r.q || 0);
  return out;
}

export function lastMonths(n = 6) {
  const out: { key: string; label: string }[] = [];
  const d = new Date();
  d.setUTCDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    out.push({ key: m.toISOString().slice(0, 7), label: m.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }) });
  }
  return out;
}

type Scope = { donorId?: number; recipientId?: number };

function scopeSql(s: Scope, alias = 'd') {
  if (s.donorId) return { sql: ` AND ${alias}.donor_id = ?`, params: [s.donorId] };
  if (s.recipientId)
    return {
      sql: ` AND EXISTS (SELECT 1 FROM donation_requests rr WHERE rr.donation_id = ${alias}.id AND rr.recipient_id = ? AND rr.status = 'accepted')`,
      params: [s.recipientId],
    };
  return { sql: '', params: [] as number[] };
}

export function deliveredTotals(s: Scope = {}): UnitTotals {
  const sc = scopeSql(s);
  return totals(
    getDb()
      .prepare(`SELECT d.unit, SUM(c.quantity_delivered) AS q FROM donations d JOIN collections c ON c.donation_id = d.id
                WHERE d.status = 'delivered'${sc.sql} GROUP BY d.unit`)
      .all(...sc.params) as { unit: string; q: number }[]
  );
}

export function statusCounts(s: Scope = {}): Record<string, number> {
  const sc = scopeSql(s);
  const out: Record<string, number> = {};
  for (const r of getDb().prepare(`SELECT d.status, COUNT(*) AS n FROM donations d WHERE 1=1${sc.sql} GROUP BY d.status`).all(...sc.params))
    out[String(r.status)] = Number(r.n);
  return out;
}

export function fulfillment(s: Scope = {}) {
  const sc = scopeSql(s);
  const r = getDb()
    .prepare(
      `SELECT SUM(CASE WHEN d.status = 'delivered' THEN 1 ELSE 0 END) AS done, COUNT(*) AS eligible
       FROM donations d JOIN donation_requests r ON r.donation_id = d.id AND r.status IN ('accepted','cancelled')
       WHERE d.status IN ('delivered','failed','cancelled','expired')
         AND EXISTS (SELECT 1 FROM donation_status_history h WHERE h.donation_id = d.id AND h.to_status = 'accepted')${sc.sql}`
    )
    .get(...sc.params)!;
  const eligible = Number(r.eligible || 0);
  const done = Number(r.done || 0);
  return { done, eligible, rate: eligible ? done / eligible : null };
}

export function monthlyDelivered(s: Scope = {}, unit = 'kg', months = 6) {
  const sc = scopeSql(s);
  const rows = getDb()
    .prepare(
      `SELECT substr(c.actual_delivery_time, 1, 7) AS m, SUM(c.quantity_delivered) AS q, COUNT(*) AS n
       FROM donations d JOIN collections c ON c.donation_id = d.id
       WHERE d.status = 'delivered' AND d.unit = ?${sc.sql} GROUP BY m`
    )
    .all(unit, ...sc.params);
  const pub = getDb()
    .prepare(`SELECT substr(d.created_at, 1, 7) AS m, SUM(d.quantity_available) AS q FROM donations d WHERE d.unit = ? AND d.status != 'rejected'${sc.sql} GROUP BY m`)
    .all(unit, ...sc.params);
  const by = new Map(rows.map((r) => [String(r.m), r]));
  const byPub = new Map(pub.map((r) => [String(r.m), Number(r.q)]));
  return lastMonths(months).map(({ key, label }) => ({
    month: label,
    delivered: Math.round(Number(by.get(key)?.q ?? 0) * 10) / 10,
    published: Math.round((byPub.get(key) ?? 0) * 10) / 10,
    completed: Number(by.get(key)?.n ?? 0),
  }));
}

export function categoryBreakdown(s: Scope = {}, onlyDelivered = false) {
  const sc = scopeSql(s);
  return getDb()
    .prepare(
      `SELECT d.food_category AS category, COUNT(*) AS count FROM donations d
       WHERE ${onlyDelivered ? "d.status = 'delivered'" : "d.status != 'rejected'"}${sc.sql}
       GROUP BY d.food_category ORDER BY count DESC`
    )
    .all(...sc.params)
    .map((r) => ({ category: String(r.category), count: Number(r.count) }));
}

export function donatedTotals(s: Scope = {}): UnitTotals {
  const sc = scopeSql(s);
  return totals(
    getDb()
      .prepare(`SELECT d.unit, SUM(d.quantity_available) AS q FROM donations d WHERE d.status NOT IN ('rejected','cancelled')${sc.sql} GROUP BY d.unit`)
      .all(...sc.params) as { unit: string; q: number }[]
  );
}

export function recordedWaste(donorId: number, sinceDays = 30): UnitTotals {
  const since = new Date(Date.now() - sinceDays * 86400_000).toISOString().slice(0, 10);
  const a = getDb()
    .prepare(`SELECT 'units' AS unit, SUM(waste_quantity) AS q FROM sales_history WHERE donor_id = ? AND date >= ? `)
    .all(donorId, since) as { unit: string; q: number }[];
  const b = getDb()
    .prepare(`SELECT unit, SUM(wasted_quantity) AS q FROM inventory_records WHERE donor_id = ? AND updated_at >= ? GROUP BY unit`)
    .all(donorId, since) as { unit: string; q: number }[];
  return totals([...a, ...b]);
}

export function donorAnalytics(donorId: number) {
  return {
    donated: donatedTotals({ donorId }),
    delivered: deliveredTotals({ donorId }),
    statuses: statusCounts({ donorId }),
    fulfillment: fulfillment({ donorId }),
    waste30: recordedWaste(donorId, 30),
    monthly: monthlyDelivered({ donorId }),
    categories: categoryBreakdown({ donorId }),
  };
}

export function recipientAnalytics(recipientId: number) {
  const st = statusCounts({ recipientId });
  return {
    received: deliveredTotals({ recipientId }),
    statuses: st,
    completed: st.delivered ?? 0,
    failedOrCancelled: (st.failed ?? 0) + (st.cancelled ?? 0) + (st.expired ?? 0),
    monthly: monthlyDelivered({ recipientId }),
    categories: categoryBreakdown({ recipientId }, true),
  };
}

export function platformAnalytics() {
  const db = getDb();
  const verified = (kind: string) =>
    Number(db.prepare(`SELECT COUNT(*) AS n FROM organizations o JOIN users u ON u.id = o.user_id WHERE kind = ? AND verification_status = 'verified' AND u.account_status = 'active'`).get(kind)!.n);
  return {
    verifiedDonors: verified('donor'),
    verifiedRecipients: verified('recipient'),
    published: Number(db.prepare(`SELECT COUNT(*) AS n FROM donations WHERE status != 'rejected'`).get()!.n),
    delivered: deliveredTotals(),
    statuses: statusCounts(),
    fulfillment: fulfillment(),
    monthly: monthlyDelivered(),
    categories: categoryBreakdown(),
    geography: db
      .prepare(`SELECT area, SUM(CASE WHEN kind='donor' THEN 1 ELSE 0 END) AS donors, SUM(CASE WHEN kind='recipient' THEN 1 ELSE 0 END) AS recipients
                FROM organizations WHERE verification_status = 'verified' GROUP BY area ORDER BY (donors + recipients) DESC`)
      .all()
      .map((r) => ({ area: String(r.area), donors: Number(r.donors), recipients: Number(r.recipients) })),
    registrations: lastMonths(6).map(({ key, label }) => ({
      month: label,
      users: Number(db.prepare(`SELECT COUNT(*) AS n FROM users WHERE substr(created_at, 1, 7) = ?`).get(key)!.n),
    })),
  };
}

export function publicStats() {
  const db = getDb();
  const delivered = deliveredTotals();
  const activeDonors = Number(
    db.prepare(`SELECT COUNT(DISTINCT d.donor_id) AS n FROM donations d WHERE d.created_at >= ?`).get(new Date(Date.now() - 90 * 86400_000).toISOString())!.n
  );
  const verifiedRecipients = Number(
    db.prepare(`SELECT COUNT(*) AS n FROM organizations WHERE kind = 'recipient' AND verification_status = 'verified'`).get()!.n
  );
  const completed = Number(db.prepare(`SELECT COUNT(*) AS n FROM donations WHERE status = 'delivered'`).get()!.n);
  const demo = db.prepare(`SELECT value FROM settings WHERE key = 'demo_mode'`).get();
  const f = fulfillment();
  return {
    foodRescuedKg: Math.round((delivered.kg ?? 0) * 10) / 10,
    foodRescuedLiters: Math.round((delivered.liters ?? 0) * 10) / 10,
    completedDonations: completed,
    activeDonors,
    verifiedRecipients,
    fulfillmentRate: f.rate,
    isDemo: demo?.value === '1',
  };
}
