import { z } from 'zod';
import { getDb, nowIso } from '@/lib/db';
import { apiUser, badRequest, forbidden, handle, idParam, notFound, parseBody } from '@/lib/api';
import { inventorySchema } from '@/lib/validation';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

function own(userId: number, id: number) {
  const r = getDb().prepare('SELECT * FROM inventory_records WHERE id = ?').get(id);
  if (!r) throw notFound('Inventory record not found.');
  if (Number(r.donor_id) !== userId) throw forbidden();
  return r;
}

const action = z.object({
  action: z.enum(['sold', 'wasted', 'donation', 'archive', 'restore']),
  quantity: z.coerce.number().min(0).optional(),
});

export const PATCH = handle<{ params: { id: string } }>(async (req, { params }) => {
  const user = apiUser(['donor']);
  const id = idParam(params.id);
  const rec = own(user.id, id);
  const json = await req.json().catch(() => null);
  if (!json) throw badRequest('Request body must be valid JSON.');
  const db = getDb();
  const now = nowIso();
  if (json.action) {
    const a = action.parse(json);
    const q = Number(rec.quantity);
    const amount = a.quantity ?? q;
    if (amount > q + 1e-9) throw badRequest('Quantity is more than the recorded stock.', { quantity: `Max ${q} ${rec.unit}.` });
    if (a.action === 'sold' || a.action === 'wasted') {
      const left = Math.round((q - amount) * 1000) / 1000;
      db.prepare(`UPDATE inventory_records SET quantity = ?, wasted_quantity = wasted_quantity + ?, status = ?, updated_at = ? WHERE id = ?`)
        .run(left, a.action === 'wasted' ? amount : 0, left <= 0 ? a.action : 'in_stock', now, id);
    } else if (a.action === 'donation') {
      db.prepare(`UPDATE inventory_records SET status = 'donation', updated_at = ? WHERE id = ?`).run(now, id);
    } else {
      db.prepare(`UPDATE inventory_records SET status = ?, updated_at = ? WHERE id = ?`).run(a.action === 'archive' ? 'archived' : 'in_stock', now, id);
    }
    audit(user.id, `inventory.${a.action}`, 'inventory', id, null, { quantity: amount });
    return { ok: true };
  }
  const b = inventorySchema.parse(json);
  db.prepare(`UPDATE inventory_records SET item_name = ?, food_category = ?, quantity = ?, unit = ?, recorded_date = ?, safe_until = ?, shelf_life_days = ?,
    storage_requirement = ?, updated_at = ? WHERE id = ?`)
    .run(b.item_name, b.food_category, b.quantity, b.unit, b.recorded_date, b.safe_until ? new Date(b.safe_until).toISOString() : null,
      b.shelf_life_days ?? null, b.storage_requirement, now, id);
  audit(user.id, 'inventory.update', 'inventory', id);
  return { ok: true };
});

// "Delete" archives the record — inventory history is never hard-deleted.
export const DELETE = handle<{ params: { id: string } }>(async (_req, { params }) => {
  const user = apiUser(['donor']);
  const id = idParam(params.id);
  own(user.id, id);
  getDb().prepare(`UPDATE inventory_records SET status = 'archived', updated_at = ? WHERE id = ?`).run(nowIso(), id);
  audit(user.id, 'inventory.archive', 'inventory', id);
  return { ok: true };
});
