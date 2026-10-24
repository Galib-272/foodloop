import { getDb, nowIso } from '@/lib/db';
import { apiUser, conflict, forbidden, handle, idParam, notFound, parseBody } from '@/lib/api';
import { donationSchema } from '@/lib/validation';
import { getDonation, redact, viewerFor } from '@/lib/donations';
import { donationCollection, donationHistory, donationRequests } from '@/lib/donation-queries';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export const GET = handle<{ params: { id: string } }>(async (_req, { params }) => {
  const user = apiUser();
  const d = getDonation(idParam(params.id));
  if (!d) throw notFound('Donation not found.');
  const v = viewerFor(user, d);
  const open = d.status === 'available' || d.status === 'requested';
  if (!open && !v.isOwner && !v.acceptedRecipient && !v.assignedVolunteer && user.role !== 'admin') {
    // Recipients who had a request on it can still see the outcome.
    const had = getDb().prepare('SELECT 1 FROM donation_requests WHERE donation_id = ? AND recipient_id = ?').get(d.id, user.id);
    if (!had) throw forbidden('This donation is no longer available.');
  }
  const privileged = v.isOwner || user.role === 'admin';
  return {
    donation: redact(d, v),
    history: donationHistory(d.id),
    requests: privileged ? donationRequests(d.id) : donationRequests(d.id).filter((r) => Number(r.recipient_id) === user.id),
    collection: v.canSeeContact ? donationCollection(d.id) : null,
  };
});

export const PATCH = handle<{ params: { id: string } }>(async (req, { params }) => {
  const user = apiUser(['donor']);
  const d = getDonation(idParam(params.id));
  if (!d) throw notFound();
  if (d.donor_id !== user.id) throw forbidden('You can only edit your own donations.');
  if (d.status !== 'available') throw conflict('Donations can only be edited while available and before any request.');
  const b = await parseBody(req, donationSchema);
  getDb().prepare(
    `UPDATE donations SET item_name = ?, food_category = ?, description = ?, quantity_available = ?, unit = ?, prepared_at = ?, available_from = ?,
      safe_until = ?, storage_requirement = ?, pickup_address = ?, area = COALESCE(?, area), latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude),
      packaging = ?, allergens = ?, handling_instructions = ?, contact_method = ?, notes = ?, updated_at = ? WHERE id = ? AND status = 'available'`
  ).run(b.item_name, b.food_category, b.description || null, b.quantity_available, b.unit, b.prepared_at ? new Date(b.prepared_at).toISOString() : null,
    new Date(b.available_from).toISOString(), new Date(b.safe_until).toISOString(), b.storage_requirement, b.pickup_address, b.area || null,
    b.latitude ?? null, b.longitude ?? null, b.packaging, b.allergens || null, b.handling_instructions || null, b.contact_method, b.notes || null, nowIso(), d.id);
  getDb().prepare('INSERT INTO donation_status_history (donation_id, from_status, to_status, actor_user_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(d.id, 'available', 'available', user.id, 'Donation details edited', nowIso());
  audit(user.id, 'donation.update', 'donation', d.id);
  return { ok: true };
});
