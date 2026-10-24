import { getDb } from './db';
import { DONATION_SELECT, sweepDeadlines, type Donation } from './donations';

export type DonationFilters = {
  status?: string[];
  category?: string;
  storage?: string;
  q?: string;
  donorId?: number;
  activeOnly?: boolean; // not past deadline
  verifiedDonorOnly?: boolean;
  limit?: number;
};

export function listDonations(f: DonationFilters = {}): Donation[] {
  sweepDeadlines();
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (f.status?.length) {
    where.push(`d.status IN (${f.status.map(() => '?').join(',')})`);
    params.push(...f.status);
  }
  if (f.category) { where.push('d.food_category = ?'); params.push(f.category); }
  if (f.storage) { where.push('d.storage_requirement = ?'); params.push(f.storage); }
  if (f.donorId) { where.push('d.donor_id = ?'); params.push(f.donorId); }
  if (f.activeOnly) { where.push('d.safe_until > ?'); params.push(new Date().toISOString()); }
  if (f.verifiedDonorOnly) where.push(`o.verification_status = 'verified'`);
  if (f.q) {
    where.push('(d.item_name LIKE ? OR d.food_category LIKE ? OR d.area LIKE ? OR CAST(d.id AS TEXT) = ?)');
    const like = `%${f.q.replace(/[%_]/g, '')}%`;
    params.push(like, like, like, f.q.replace(/^#?D?-?/i, ''));
  }
  return getDb()
    .prepare(`${DONATION_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY d.created_at DESC LIMIT ?`)
    .all(...params, f.limit ?? 500) as Donation[];
}

export function donationHistory(id: number) {
  return getDb()
    .prepare(
      `SELECT h.*, u.full_name AS actor_name, u.role AS actor_role FROM donation_status_history h
       LEFT JOIN users u ON u.id = h.actor_user_id WHERE h.donation_id = ? ORDER BY h.created_at ASC, h.id ASC`
    )
    .all(id);
}

export function donationRequests(id: number) {
  return getDb()
    .prepare(
      `SELECT r.*, o.organization_name, o.organization_type, o.area, o.verification_status, o.id AS org_id
       FROM donation_requests r LEFT JOIN organizations o ON o.user_id = r.recipient_id
       WHERE r.donation_id = ? ORDER BY r.request_time DESC`
    )
    .all(id);
}

export function donationCollection(id: number) {
  return getDb()
    .prepare(`SELECT c.*, v.full_name AS volunteer_name, v.phone AS volunteer_phone FROM collections c LEFT JOIN users v ON v.id = c.assigned_volunteer_id WHERE c.donation_id = ?`)
    .get(id) ?? null;
}

export const displayId = (id: number) => `D-${String(id).padStart(4, '0')}`;
