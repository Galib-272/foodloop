import { getDb, nowIso } from '@/lib/db';
import { apiUser, handle, parseBody } from '@/lib/api';
import { inventorySchema } from '@/lib/validation';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => {
  const user = apiUser(['donor']);
  const u = new URL(req.url);
  const showArchived = u.searchParams.get('archived') === '1';
  return {
    inventory: getDb()
      .prepare(`SELECT * FROM inventory_records WHERE donor_id = ? ${showArchived ? '' : "AND status != 'archived'"} ORDER BY updated_at DESC`)
      .all(user.id),
  };
});

export const POST = handle(async (req) => {
  const user = apiUser(['donor']);
  const b = await parseBody(req, inventorySchema);
  const now = nowIso();
  const safe = b.safe_until ? new Date(b.safe_until).toISOString() : b.shelf_life_days != null
    ? new Date(Date.parse(b.recorded_date + 'T00:00:00Z') + b.shelf_life_days * 86400_000).toISOString() : null;
  const id = Number(getDb().prepare(
    `INSERT INTO inventory_records (donor_id, item_name, food_category, quantity, unit, recorded_date, safe_until, shelf_life_days, storage_requirement, source, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', 'in_stock', ?, ?)`
  ).run(user.id, b.item_name, b.food_category, b.quantity, b.unit, b.recorded_date, safe, b.shelf_life_days ?? null, b.storage_requirement, now, now).lastInsertRowid);
  audit(user.id, 'inventory.create', 'inventory', id);
  return { ok: true, id };
});
