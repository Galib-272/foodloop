import { getDb, nowIso } from '@/lib/db';
import { apiUser, handle, parseBody } from '@/lib/api';
import { donationSchema } from '@/lib/validation';
import { listDonations } from '@/lib/donation-queries';
import { getDonation, redact, requireVerified, viewerFor } from '@/lib/donations';
import { matchesForDonation } from '@/lib/matching';
import { audit, notify } from '@/lib/audit';
import { getOrgByUser } from '@/lib/orgs';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => {
  const user = apiUser();
  const u = new URL(req.url);
  const status = u.searchParams.get('status')?.split(',').filter(Boolean);
  const category = u.searchParams.get('category') || undefined;
  const q = u.searchParams.get('q') || undefined;
  if (user.role === 'donor') return { donations: listDonations({ donorId: user.id, status, category, q }) };
  if (user.role === 'admin') return { donations: listDonations({ status, category, q }) };
  // Recipients and volunteers only see open listings, with contact details redacted.
  const list = listDonations({ status: ['available', 'requested'], category, q, activeOnly: true });
  return { donations: list.map((d) => redact(d, viewerFor(user, d))) };
});

export const POST = handle(async (req) => {
  const user = apiUser(['donor']);
  requireVerified(user, 'publish donations');
  const d = await parseBody(req, donationSchema);
  const org = getOrgByUser(user.id)!;
  const db = getDb();
  const now = nowIso();
  const id = Number(
    db.prepare(
      `INSERT INTO donations (donor_id, item_name, food_category, description, quantity_available, unit, prepared_at, available_from, safe_until,
        storage_requirement, pickup_address, area, latitude, longitude, packaging, allergens, handling_instructions, contact_method, notes,
        forecast_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?)`
    ).run(user.id, d.item_name, d.food_category, d.description || null, d.quantity_available, d.unit,
      d.prepared_at ? new Date(d.prepared_at).toISOString() : null, new Date(d.available_from).toISOString(), new Date(d.safe_until).toISOString(),
      d.storage_requirement, d.pickup_address, d.area || org.area, d.latitude ?? org.latitude, d.longitude ?? org.longitude,
      d.packaging, d.allergens || null, d.handling_instructions || null, d.contact_method, d.notes || null, d.forecast_id ?? null, now, now).lastInsertRowid
  );
  db.prepare('INSERT INTO donation_status_history (donation_id, from_status, to_status, actor_user_id, note, created_at) VALUES (?, NULL, ?, ?, ?, ?)')
    .run(id, 'available', user.id, d.forecast_id ? 'Published (quantity confirmed by donor after AI forecast)' : 'Donation published', now);
  if (d.inventory_id) {
    db.prepare(`UPDATE inventory_records SET status = 'donation', updated_at = ? WHERE id = ? AND donor_id = ?`).run(now, d.inventory_id, user.id);
  }
  audit(user.id, 'donation.create', 'donation', id, null, { forecast_id: d.forecast_id ?? null });
  // Notify the best-matching eligible recipients.
  const donation = getDonation(id)!;
  const { matches } = matchesForDonation(donation);
  for (const m of matches.slice(0, 3)) {
    notify(m.recipient_user_id, 'New suitable donation', `${d.item_name} (${d.quantity_available} ${d.unit}) is available in ${donation.area}. Match score ${m.score}/100.`, `/app/donations/${id}`, { type: 'donation', id });
  }
  return { ok: true, id, matches: matches.length };
});
