import { getDb, nowIso } from '@/lib/db';
import { apiUser, badRequest, conflict, handle, parseBody } from '@/lib/api';
import { donorOrgSchema, recipientOrgSchema } from '@/lib/validation';
import { getOrgByUser } from '@/lib/orgs';
import { audit, notify } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const user = apiUser(['donor', 'recipient']);
  return { organization: getOrgByUser(user.id) };
});

async function readOrg(req: Request, role: 'donor' | 'recipient') {
  if (role === 'donor') {
    const d = await parseBody(req, donorOrgSchema);
    return { ...d, accepted_categories: [] as string[], storage_capabilities: ['ambient'], receiving_capacity: 0, required_quantity: 0 };
  }
  return parseBody(req, recipientOrgSchema);
}

export const POST = handle(async (req) => {
  const user = apiUser(['donor', 'recipient']);
  if (getOrgByUser(user.id)) throw conflict('An organization profile already exists for this account.');
  const role = user.role as 'donor' | 'recipient';
  const d = await readOrg(req, role);
  if (d.operating_hours_open >= d.operating_hours_close) throw badRequest('Please correct the highlighted fields.', { operating_hours_close: 'Must be later than the opening time.' });
  const db = getDb();
  const now = nowIso();
  const id = Number(
    db.prepare(
      `INSERT INTO organizations (user_id, kind, organization_name, organization_type, address, area, latitude, longitude, phone,
        contact_person, verification_status, verification_details, accepted_categories, storage_capabilities, receiving_capacity,
        required_quantity, operating_hours_open, operating_hours_close, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(user.id, role, d.organization_name, d.organization_type, d.address, d.area, d.latitude ?? null, d.longitude ?? null,
      d.phone || null, d.contact_person, d.verification_details || null, JSON.stringify(d.accepted_categories),
      JSON.stringify(d.storage_capabilities), d.receiving_capacity, d.required_quantity, d.operating_hours_open,
      d.operating_hours_close, now, now).lastInsertRowid
  );
  db.prepare('UPDATE users SET onboarded = 1, updated_at = ? WHERE id = ?').run(now, user.id);
  audit(user.id, 'organization.create', 'organization', id, null, { kind: role });
  for (const a of db.prepare(`SELECT id FROM users WHERE role = 'admin' AND account_status = 'active'`).all()) {
    notify(Number(a.id), 'New verification request', `${d.organization_name} submitted verification details.`, '/app/admin/verifications', { type: 'user', id: user.id });
  }
  return { ok: true, id };
});

export const PATCH = handle(async (req) => {
  const user = apiUser(['donor', 'recipient']);
  const org = getOrgByUser(user.id);
  if (!org) throw badRequest('Complete onboarding first.');
  const d = await readOrg(req, user.role as 'donor' | 'recipient');
  if (d.operating_hours_open >= d.operating_hours_close) throw badRequest('Please correct the highlighted fields.', { operating_hours_close: 'Must be later than the opening time.' });
  getDb().prepare(
    `UPDATE organizations SET organization_name = ?, organization_type = ?, address = ?, area = ?, latitude = ?, longitude = ?,
      phone = ?, contact_person = ?, verification_details = ?, accepted_categories = ?, storage_capabilities = ?,
      receiving_capacity = ?, required_quantity = ?, operating_hours_open = ?, operating_hours_close = ?, updated_at = ? WHERE id = ?`
  ).run(d.organization_name, d.organization_type, d.address, d.area, d.latitude ?? null, d.longitude ?? null, d.phone || null,
    d.contact_person, d.verification_details || null, JSON.stringify(d.accepted_categories), JSON.stringify(d.storage_capabilities),
    d.receiving_capacity, d.required_quantity, d.operating_hours_open, d.operating_hours_close, nowIso(), org.id);
  audit(user.id, 'organization.update', 'organization', org.id);
  return { ok: true };
});
