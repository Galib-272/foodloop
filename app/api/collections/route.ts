import { getDb } from '@/lib/db';
import { apiUser, handle } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const user = apiUser();
  const base = `SELECT c.*, d.item_name, d.food_category, d.quantity_available, d.unit, d.status AS donation_status, d.safe_until, d.area
                FROM collections c JOIN donations d ON d.id = c.donation_id JOIN donation_requests r ON r.id = c.request_id`;
  const db = getDb();
  if (user.role === 'admin') return { collections: db.prepare(`${base} ORDER BY c.updated_at DESC LIMIT 200`).all() };
  if (user.role === 'donor') return { collections: db.prepare(`${base} WHERE d.donor_id = ? ORDER BY c.updated_at DESC`).all(user.id) };
  if (user.role === 'recipient') return { collections: db.prepare(`${base} WHERE r.recipient_id = ? ORDER BY c.updated_at DESC`).all(user.id) };
  return { collections: db.prepare(`${base} WHERE c.assigned_volunteer_id = ? ORDER BY c.updated_at DESC`).all(user.id) };
});
