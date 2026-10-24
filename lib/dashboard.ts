import { getDb } from './db';
import { donorAnalytics } from './analytics';
import { leftoverSeries } from './forecast';
import { listDonations } from './donation-queries';
import { sweepDeadlines, type Donation } from './donations';
import { getOrgByUser, type Org } from './orgs';
import { recommendationsForRecipient } from './matching';
import { did, qty } from './format';

export type Action = { title: string; detail: string; href: string; tone: 'red' | 'amber' | 'green' | 'blue' };


export function surplusChartData(donorId: number, category = 'all', pastDays = 30) {
  return leftoverSeries(donorId, category, pastDays, 7);
}

export function donorDashboard(userId: number) {
  sweepDeadlines();
  const org = getOrgByUser(userId)!;
  const a = donorAnalytics(userId);
  const donations = listDonations({ donorId: userId, limit: 200 });
  const active = donations.filter((d) => ['available', 'requested', 'accepted', 'scheduled', 'collected'].includes(d.status));
  const chart = surplusChartData(userId);
  const db = getDb();

  const actions: Action[] = [];
  if (org.verification_status !== 'verified')
    actions.push({ title: 'Verification pending', detail: 'You can publish donations once an administrator verifies your business.', href: '/app/settings', tone: 'amber' });
  const pending = db
    .prepare(
      `SELECT r.donation_id, d.item_name, o.organization_name FROM donation_requests r JOIN donations d ON d.id = r.donation_id
       LEFT JOIN organizations o ON o.user_id = r.recipient_id WHERE d.donor_id = ? AND r.status = 'pending' AND d.status = 'requested'`
    )
    .all(userId);
  for (const p of pending)
    actions.push({ title: 'Respond to a recipient request', detail: `${p.organization_name} requested ${p.item_name} (${did(Number(p.donation_id))}).`, href: `/app/donations/${p.donation_id}`, tone: 'blue' });
  for (const d of active.filter((d) => ['available', 'requested', 'accepted'].includes(d.status) && Date.parse(d.safe_until) - Date.now() < 3 * 3600_000))
    actions.push({ title: 'Donation approaching its deadline', detail: `${d.item_name} (${did(d.id)}) must be collected soon.`, href: `/app/donations/${d.id}`, tone: 'red' });
  for (const d of active.filter((d) => d.status === 'accepted'))
    actions.push({ title: 'Schedule collection', detail: `${d.item_name} (${did(d.id)}) was accepted but has no pickup time yet.`, href: `/app/donations/${d.id}`, tone: 'amber' });
  if (chart.next && chart.next.predicted >= 5)
    actions.push({ title: chart.next.level === 'High' ? 'High waste risk predicted' : 'Review predicted leftovers',
      detail: `About ${chart.next.lower}–${chart.next.upper} units may be left over on ${chart.next.date} (waste risk: ${chart.next.level}).`, href: '/app/forecast', tone: chart.next.level === 'High' ? 'red' : 'green' });
  const nearInv = db
    .prepare(`SELECT id, item_name, quantity, unit FROM inventory_records WHERE donor_id = ? AND status = 'in_stock' AND safe_until IS NOT NULL AND safe_until <= ? AND safe_until > ? ORDER BY safe_until LIMIT 3`)
    .all(userId, new Date(Date.now() + 48 * 3600_000).toISOString(), new Date().toISOString());
  for (const i of nearInv)
    actions.push({ title: 'Publish available food', detail: `${i.item_name} (${qty(Number(i.quantity), String(i.unit))}) reaches its safe-use deadline within 48 h.`, href: `/app/donations/new?inventory=${i.id}`, tone: 'green' });

  return { org, analytics: a, active, recent: donations.slice(0, 8), chart, actions };
}

export function recipientDashboard(userId: number) {
  sweepDeadlines();
  const org = getOrgByUser(userId)!;
  const db = getDb();
  const open = listDonations({ status: ['available', 'requested'], activeOnly: true, verifiedDonorOnly: true });
  const recs = recommendationsForRecipient(org, open);
  const reqs = db
    .prepare(
      `SELECT r.*, d.item_name, d.quantity_available, d.unit, d.status AS donation_status, d.safe_until, d.food_category, o.organization_name AS donor_org,
              c.scheduled_pickup_time, c.status AS collection_status
       FROM donation_requests r JOIN donations d ON d.id = r.donation_id LEFT JOIN organizations o ON o.user_id = d.donor_id
       LEFT JOIN collections c ON c.donation_id = d.id WHERE r.recipient_id = ? ORDER BY r.request_time DESC`
    )
    .all(userId);
  const pendingCount = reqs.filter((r) => r.status === 'pending').length;
  const offers = reqs.filter((r) => r.status === 'offered' && ['available', 'requested'].includes(String(r.donation_status)));
  const activeCol = reqs.filter((r) => r.status === 'accepted' && ['accepted', 'scheduled', 'collected'].includes(String(r.donation_status)));
  const completed = reqs.filter((r) => r.status === 'accepted' && r.donation_status === 'delivered').length;
  return { org, recs, reqs, pendingCount, offers, activeCol, completed };
}

export function volunteerDashboard(userId: number) {
  const db = getDb();
  const base = `SELECT c.*, d.item_name, d.food_category, d.quantity_available, d.unit, d.status AS donation_status, d.safe_until, d.area AS pickup_area,
                  ro.area AS delivery_area, ro.organization_name AS recipient_org
                FROM collections c JOIN donations d ON d.id = c.donation_id JOIN donation_requests r ON r.id = c.request_id
                LEFT JOIN organizations ro ON ro.user_id = r.recipient_id`;
  const open = db.prepare(`${base} WHERE c.needs_volunteer = 1 AND c.assigned_volunteer_id IS NULL AND d.status = 'scheduled' ORDER BY c.scheduled_pickup_time`).all();
  const mine = db.prepare(`${base} WHERE c.assigned_volunteer_id = ? ORDER BY c.scheduled_pickup_time`).all(userId);
  return {
    open,
    assigned: mine.filter((t) => !['delivered', 'failed'].includes(String(t.task_status)) && !['delivered', 'failed', 'cancelled', 'expired'].includes(String(t.donation_status))),
    completed: mine.filter((t) => ['delivered'].includes(String(t.task_status)) || t.donation_status === 'delivered'),
    failed: mine.filter((t) => t.task_status === 'failed'),
  };
}

export type { Donation, Org };
