import { getDb, nowIso, tx, type Database } from './db';
import { audit, notify } from './audit';
import { ApiError, badRequest, conflict, forbidden, notFound } from './api';
import type { SessionUser } from './auth';
import { getOrgByUser } from './orgs';
import { TERMINAL_STATUSES, type DonationStatus } from './constants';

export type Donation = {
  id: number;
  donor_id: number;
  item_name: string;
  food_category: string;
  description: string | null;
  quantity_available: number;
  unit: string;
  prepared_at: string | null;
  available_from: string;
  safe_until: string;
  storage_requirement: string;
  pickup_address: string;
  area: string | null;
  latitude: number | null;
  longitude: number | null;
  packaging: string | null;
  allergens: string | null;
  handling_instructions: string | null;
  contact_method: string | null;
  notes: string | null;
  forecast_id: number | null;
  status: DonationStatus;
  created_at: string;
  updated_at: string;
  donor_name?: string;
  donor_org?: string;
  donor_verification?: string;
};

/* ---------- Status workflow ---------- */

// Allowed transitions. The backend rejects anything not listed here.
export const TRANSITIONS: Record<DonationStatus, DonationStatus[]> = {
  available: ['requested', 'cancelled', 'expired', 'rejected'],
  requested: ['available', 'accepted', 'cancelled', 'expired', 'rejected'],
  accepted: ['scheduled', 'cancelled', 'expired', 'failed'],
  scheduled: ['collected', 'cancelled', 'expired', 'failed'],
  collected: ['delivered', 'failed'],
  delivered: [],
  cancelled: [],
  expired: [],
  rejected: [],
  failed: [],
};

export function canTransition(from: DonationStatus, to: DonationStatus) {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

function setStatus(db: Database, d: Donation, to: DonationStatus, actor: number | null, note: string, force = false) {
  if (!force && !canTransition(d.status, to)) {
    throw conflict(`A donation cannot move from ${d.status} to ${to}.`);
  }
  const res = db
    .prepare('UPDATE donations SET status = ?, updated_at = ? WHERE id = ? AND status = ?')
    .run(to, nowIso(), d.id, d.status);
  // Optimistic concurrency: another request changed the status first.
  if (Number(res.changes) === 0) throw conflict('This donation was just updated by someone else. Please refresh.');
  db.prepare(
    'INSERT INTO donation_status_history (donation_id, from_status, to_status, actor_user_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(d.id, d.status, to, actor, note, nowIso());
  d.status = to;
}

export const DONATION_SELECT = `
  SELECT d.*, u.full_name AS donor_name, o.organization_name AS donor_org, o.verification_status AS donor_verification
  FROM donations d
  JOIN users u ON u.id = d.donor_id
  LEFT JOIN organizations o ON o.user_id = d.donor_id`;

export function getDonation(id: number): Donation | null {
  return (getDb().prepare(`${DONATION_SELECT} WHERE d.id = ?`).get(id) as Donation | undefined) ?? null;
}

function mustGet(db: Database, id: number): Donation {
  const d = db.prepare(`SELECT * FROM donations WHERE id = ?`).get(id) as Donation | undefined;
  if (!d) throw notFound('Donation not found.');
  return d;
}

/* ---------- Expiry & deadline alerts (run lazily on reads) ---------- */

let lastSweep = 0;
export function sweepDeadlines(force = false) {
  const now = Date.now();
  if (!force && now - lastSweep < 30_000) return;
  lastSweep = now;
  const db = getDb();
  const iso = new Date(now).toISOString();
  const overdue = db
    .prepare(`SELECT * FROM donations WHERE status IN ('available','requested','accepted','scheduled') AND safe_until <= ?`)
    .all(iso) as Donation[];
  for (const d of overdue) {
    try {
      tx((t) => {
        const cur = mustGet(t, d.id);
        if (!['available', 'requested', 'accepted', 'scheduled'].includes(cur.status)) return;
        setStatus(t, cur, 'expired', null, 'Safe-use deadline passed (system)');
        t.prepare(`UPDATE donation_requests SET status = 'rejected', decision_time = ? WHERE donation_id = ? AND status IN ('pending','offered')`).run(iso, d.id);
        notify(d.donor_id, 'Donation expired', `${d.item_name} passed its safe-use deadline and was marked Expired.`, `/app/donations/${d.id}`, { type: 'donation', id: d.id });
      });
    } catch {
      /* status changed concurrently; ignore */
    }
  }
  // Approaching deadline: within 2 hours, once per donation.
  const soon = new Date(now + 2 * 3600_000).toISOString();
  const approaching = db
    .prepare(
      `SELECT d.* FROM donations d LEFT JOIN deadline_alerts a ON a.donation_id = d.id
       WHERE d.status IN ('available','requested','accepted','scheduled') AND d.safe_until > ? AND d.safe_until <= ? AND a.donation_id IS NULL`
    )
    .all(iso, soon) as Donation[];
  for (const d of approaching) {
    db.prepare('INSERT OR IGNORE INTO deadline_alerts (donation_id, sent_at) VALUES (?, ?)').run(d.id, iso);
    notify(d.donor_id, 'Deadline approaching', `${d.item_name} must be collected within 2 hours.`, `/app/donations/${d.id}`, { type: 'donation', id: d.id });
    const acc = db.prepare(`SELECT recipient_id FROM donation_requests WHERE donation_id = ? AND status = 'accepted'`).get(d.id);
    if (acc) notify(Number(acc.recipient_id), 'Deadline approaching', `${d.item_name} must be collected within 2 hours.`, `/app/donations/${d.id}`, { type: 'donation', id: d.id });
  }
}

/* ---------- Visibility ---------- */

export type Viewer = { canSeeContact: boolean; canSeeExactAddress: boolean; isOwner: boolean; acceptedRecipient: boolean; assignedVolunteer: boolean };

export function viewerFor(user: SessionUser, d: Donation): Viewer {
  const db = getDb();
  const isOwner = d.donor_id === user.id;
  const acceptedRecipient =
    user.role === 'recipient' &&
    !!db.prepare(`SELECT 1 FROM donation_requests WHERE donation_id = ? AND recipient_id = ? AND status = 'accepted'`).get(d.id, user.id);
  const assignedVolunteer =
    user.role === 'volunteer' &&
    !!db.prepare(`SELECT 1 FROM collections WHERE donation_id = ? AND assigned_volunteer_id = ?`).get(d.id, user.id);
  const privileged = isOwner || acceptedRecipient || assignedVolunteer || user.role === 'admin';
  return { canSeeContact: privileged, canSeeExactAddress: privileged, isOwner, acceptedRecipient, assignedVolunteer };
}

/** Strips address/contact for viewers who are not yet entitled to them. */
export function redact(d: Donation, v: Viewer): Donation {
  if (v.canSeeExactAddress) return d;
  return {
    ...d,
    pickup_address: d.area ? `${d.area} (exact address shared after acceptance)` : 'Shared after acceptance',
    contact_method: null,
    latitude: d.latitude != null ? Math.round(d.latitude * 100) / 100 : null,
    longitude: d.longitude != null ? Math.round(d.longitude * 100) / 100 : null,
    donor_name: undefined,
  };
}

/* ---------- Actions ---------- */

export function requireVerified(user: SessionUser, what: string) {
  const org = getOrgByUser(user.id);
  if (!org) throw new ApiError(403, 'onboarding_required', 'Complete your organization profile first.');
  if (org.verification_status !== 'verified') {
    throw new ApiError(403, 'not_verified', `Your organization must be verified before you can ${what}.`);
  }
  return org;
}

export function requestDonation(user: SessionUser, donationId: number, notes?: string) {
  const org = requireVerified(user, 'request donations');
  sweepDeadlines(true);
  return tx((db) => {
    const d = mustGet(db, donationId);
    if (d.status !== 'available' && d.status !== 'requested') throw conflict('This donation is no longer available.');
    if (Date.parse(d.safe_until) <= Date.now()) throw conflict('This donation has passed its safe-use deadline.');
    if (!org.accepted_categories.includes(d.food_category))
      throw badRequest(`Your organization does not accept ${d.food_category}. Update your accepted categories to request it.`);
    if (!org.storage_capabilities.includes(d.storage_requirement))
      throw badRequest(`This donation requires ${d.storage_requirement} storage, which your profile does not list.`);
    const existing = db.prepare('SELECT id, status FROM donation_requests WHERE donation_id = ? AND recipient_id = ?').get(d.id, user.id);
    if (existing && existing.status === 'pending') throw conflict('You have already requested this donation.');
    if (existing) {
      db.prepare(`UPDATE donation_requests SET status = 'pending', request_time = ?, decision_time = NULL, notes = ?, requested_quantity = ? WHERE id = ?`)
        .run(nowIso(), notes ?? null, d.quantity_available, existing.id);
    } else {
      db.prepare('INSERT INTO donation_requests (donation_id, recipient_id, requested_quantity, status, request_time, notes) VALUES (?, ?, ?, ?, ?, ?)')
        .run(d.id, user.id, d.quantity_available, 'pending', nowIso(), notes ?? null);
    }
    if (d.status === 'available') setStatus(db, d, 'requested', user.id, `Requested by ${org.organization_name}`);
    else db.prepare('INSERT INTO donation_status_history (donation_id, from_status, to_status, actor_user_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(d.id, 'requested', 'requested', user.id, `Additional request from ${org.organization_name}`, nowIso());
    db.prepare(`UPDATE donation_matches SET status = 'requested' WHERE donation_id = ? AND recipient_id = ?`).run(d.id, user.id);
    notify(d.donor_id, 'New donation request', `${org.organization_name} requested ${d.item_name} (${d.quantity_available} ${d.unit}).`, `/app/donations/${d.id}`, { type: 'donation', id: d.id });
    audit(user.id, 'donation.request', 'donation', d.id);
    return { ok: true };
  });
}

export function withdrawRequest(user: SessionUser, donationId: number) {
  return tx((db) => {
    const d = mustGet(db, donationId);
    const r = db.prepare(`SELECT id FROM donation_requests WHERE donation_id = ? AND recipient_id = ? AND status = 'pending'`).get(d.id, user.id);
    if (!r) throw notFound('No pending request to withdraw.');
    db.prepare(`UPDATE donation_requests SET status = 'withdrawn', decision_time = ? WHERE id = ?`).run(nowIso(), r.id);
    const pending = db.prepare(`SELECT COUNT(*) AS n FROM donation_requests WHERE donation_id = ? AND status = 'pending'`).get(d.id)!;
    if (d.status === 'requested' && Number(pending.n) === 0) setStatus(db, d, 'available', user.id, 'Request withdrawn; donation available again');
    notify(d.donor_id, 'Request withdrawn', `A recipient withdrew their request for ${d.item_name}.`, `/app/donations/${d.id}`, { type: 'donation', id: d.id });
    return { ok: true };
  });
}

function ownDonation(db: Database, user: SessionUser, donationId: number) {
  const d = mustGet(db, donationId);
  if (d.donor_id !== user.id && user.role !== 'admin') throw forbidden('Only the donor can manage this donation.');
  return d;
}

export function acceptRequest(user: SessionUser, donationId: number, requestId: number) {
  sweepDeadlines(true);
  return tx((db) => {
    const d = ownDonation(db, user, donationId);
    const r = db.prepare('SELECT * FROM donation_requests WHERE id = ? AND donation_id = ?').get(requestId, d.id);
    if (!r) throw notFound('Request not found.');
    if (r.status !== 'pending') throw conflict('This request is no longer pending.');
    if (Date.parse(d.safe_until) <= Date.now()) throw conflict('This donation has passed its safe-use deadline.');
    const rec = getOrgByUser(Number(r.recipient_id));
    if (!rec || rec.verification_status !== 'verified') throw conflict('This recipient is no longer verified.');
    // Transition first: if another request was accepted concurrently this throws and nothing is written.
    setStatus(db, d, 'accepted', user.id, `Accepted request from ${rec.organization_name}`);
    db.prepare(`UPDATE donation_requests SET status = 'accepted', decision_time = ? WHERE id = ?`).run(nowIso(), r.id);
    const others = db.prepare(`SELECT recipient_id FROM donation_requests WHERE donation_id = ? AND status IN ('pending','offered')`).all(d.id);
    db.prepare(`UPDATE donation_requests SET status = 'rejected', decision_time = ?, notes = COALESCE(notes, '') || ' [Another request was accepted]' WHERE donation_id = ? AND status IN ('pending','offered')`).run(nowIso(), d.id);
    db.prepare(
      `INSERT INTO collections (donation_id, request_id, task_status, status, created_at, updated_at) VALUES (?, ?, 'unassigned', 'pending', ?, ?)`
    ).run(d.id, r.id, nowIso(), nowIso());
    notify(Number(r.recipient_id), 'Request accepted', `Your request for ${d.item_name} was accepted. Please schedule collection.`, `/app/donations/${d.id}`, { type: 'donation', id: d.id });
    for (const o of others) notify(Number(o.recipient_id), 'Request not accepted', `Another organization was selected for ${d.item_name}.`, `/app/donations/${d.id}`, { type: 'donation', id: d.id });
    audit(user.id, 'donation.accept_request', 'donation', d.id, null, { request_id: r.id });
    return { ok: true };
  });
}

export function rejectRequest(user: SessionUser, donationId: number, requestId: number, reason?: string) {
  return tx((db) => {
    const d = ownDonation(db, user, donationId);
    const r = db.prepare('SELECT * FROM donation_requests WHERE id = ? AND donation_id = ?').get(requestId, d.id);
    if (!r || r.status !== 'pending') throw conflict('This request is no longer pending.');
    db.prepare(`UPDATE donation_requests SET status = 'rejected', decision_time = ?, notes = ? WHERE id = ?`).run(nowIso(), reason ?? r.notes, r.id);
    const pending = db.prepare(`SELECT COUNT(*) AS n FROM donation_requests WHERE donation_id = ? AND status = 'pending'`).get(d.id)!;
    if (d.status === 'requested' && Number(pending.n) === 0) setStatus(db, d, 'available', user.id, 'Request declined; donation available again');
    notify(Number(r.recipient_id), 'Request declined', `Your request for ${d.item_name} was declined.${reason ? ' Reason: ' + reason : ''}`, `/app/donations/${d.id}`, { type: 'donation', id: d.id });
    audit(user.id, 'donation.reject_request', 'donation', d.id, reason, { request_id: r.id });
    return { ok: true };
  });
}

function acceptedRequest(db: Database, donationId: number) {
  return db.prepare(`SELECT * FROM donation_requests WHERE donation_id = ? AND status = 'accepted'`).get(donationId);
}

export function cancelDonation(user: SessionUser, donationId: number, reason: string) {
  if (!reason?.trim()) throw badRequest('Please give a reason for cancelling.', { reason: 'A reason is required.' });
  return tx((db) => {
    const d = ownDonation(db, user, donationId);
    if (TERMINAL_STATUSES.includes(d.status) || d.status === 'collected') throw conflict('This donation can no longer be cancelled.');
    const acc = acceptedRequest(db, d.id);
    setStatus(db, d, 'cancelled', user.id, `Cancelled: ${reason}`);
    db.prepare(`UPDATE donation_requests SET status = 'cancelled', decision_time = ? WHERE donation_id = ? AND status IN ('pending','offered','accepted')`).run(nowIso(), d.id);
    db.prepare(`UPDATE collections SET status = 'cancelled', updated_at = ? WHERE donation_id = ?`).run(nowIso(), d.id);
    if (acc) notify(Number(acc.recipient_id), 'Donation cancelled', `${d.item_name} was cancelled by the donor. Reason: ${reason}`, `/app/donations/${d.id}`, { type: 'donation', id: d.id });
    audit(user.id, 'donation.cancel', 'donation', d.id, reason);
    return { ok: true };
  });
}

function partyCheck(db: Database, user: SessionUser, d: Donation) {
  const acc = acceptedRequest(db, d.id);
  const col = db.prepare('SELECT * FROM collections WHERE donation_id = ?').get(d.id);
  const isDonor = d.donor_id === user.id;
  const isRecipient = !!acc && Number(acc.recipient_id) === user.id;
  const isVolunteer = !!col && col.assigned_volunteer_id != null && Number(col.assigned_volunteer_id) === user.id;
  if (!isDonor && !isRecipient && !isVolunteer && user.role !== 'admin') throw forbidden('Only the parties to this donation can update its collection.');
  return { acc, col, isDonor, isRecipient, isVolunteer };
}

export function scheduleCollection(user: SessionUser, donationId: number, pickupTime: string, needsVolunteer: boolean) {
  const t = Date.parse(pickupTime);
  if (Number.isNaN(t)) throw badRequest('Choose a valid pickup time.', { pickup_time: 'Invalid date/time.' });
  return tx((db) => {
    const d = mustGet(db, donationId);
    const { acc, isDonor, isRecipient } = partyCheck(db, user, d);
    if (!isDonor && !isRecipient && user.role !== 'admin') throw forbidden();
    if (d.status !== 'accepted' && d.status !== 'scheduled') throw conflict('Collection can only be scheduled after a request is accepted.');
    if (t >= Date.parse(d.safe_until)) throw badRequest('Pickup must be before the safe-use deadline.', { pickup_time: 'Must be before the safe-use deadline.' });
    if (t < Date.now() - 15 * 60_000) throw badRequest('Pickup time is in the past.', { pickup_time: 'Choose a future time.' });
    db.prepare(`UPDATE collections SET scheduled_pickup_time = ?, needs_volunteer = ?, status = 'scheduled', updated_at = ? WHERE donation_id = ?`)
      .run(new Date(t).toISOString(), needsVolunteer ? 1 : 0, nowIso(), d.id);
    if (d.status === 'accepted') setStatus(db, d, 'scheduled', user.id, `Pickup scheduled${needsVolunteer ? ' (volunteer help requested)' : ''}`);
    else db.prepare('INSERT INTO donation_status_history (donation_id, from_status, to_status, actor_user_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(d.id, 'scheduled', 'scheduled', user.id, 'Pickup time changed', nowIso());
    const other = isDonor ? Number(acc!.recipient_id) : d.donor_id;
    notify(other, 'Collection scheduled', `Pickup for ${d.item_name} is scheduled for ${new Date(t).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' })}.`, `/app/donations/${d.id}`, { type: 'donation', id: d.id });
    if (needsVolunteer) {
      for (const v of db.prepare(`SELECT id FROM users WHERE role = 'volunteer' AND account_status = 'active'`).all())
        notify(Number(v.id), 'New collection task available', `${d.item_name} (${d.quantity_available} ${d.unit}) needs a volunteer for pickup.`, '/app/tasks', { type: 'donation', id: d.id });
    }
    audit(user.id, 'collection.schedule', 'donation', d.id, null, { pickup: new Date(t).toISOString(), needsVolunteer });
    return { ok: true };
  });
}

export function markCollected(user: SessionUser, donationId: number, quantity?: number) {
  return tx((db) => {
    const d = mustGet(db, donationId);
    const { acc } = partyCheck(db, user, d);
    if (d.status !== 'scheduled') throw conflict('Only a scheduled donation can be marked collected.');
    const qty = quantity ?? d.quantity_available;
    if (!(qty > 0) || qty > d.quantity_available) throw badRequest('Collected quantity must be between 0 and the donated quantity.', { quantity: 'Invalid quantity.' });
    db.prepare(`UPDATE collections SET actual_pickup_time = ?, quantity_collected = ?, status = 'collected',
      task_status = CASE WHEN assigned_volunteer_id IS NOT NULL THEN 'collected' ELSE task_status END, updated_at = ? WHERE donation_id = ?`)
      .run(nowIso(), qty, nowIso(), d.id);
    setStatus(db, d, 'collected', user.id, `Collected ${qty} ${d.unit}`);
    for (const uid of [d.donor_id, Number(acc?.recipient_id)].filter((x) => x && x !== user.id))
      notify(uid, 'Donation collected', `${d.item_name} has been picked up.`, `/app/donations/${d.id}`, { type: 'donation', id: d.id });
    return { ok: true };
  });
}

export function confirmDelivery(
  user: SessionUser,
  donationId: number,
  body: { quantity_received: number; delivery_time?: string; as_expected: boolean; discrepancy?: string; notes?: string }
) {
  return tx((db) => {
    const d = mustGet(db, donationId);
    const { acc, isRecipient } = partyCheck(db, user, d);
    if (!isRecipient && user.role !== 'admin') throw forbidden('Only the receiving organization can confirm receipt.');
    if (d.status !== 'collected') throw conflict('A donation must be collected before delivery can be confirmed.');
    const q = Number(body.quantity_received);
    if (!(q >= 0) || q > d.quantity_available) throw badRequest('Received quantity must be between 0 and the donated quantity.', { quantity_received: `Enter 0–${d.quantity_available} ${d.unit}.` });
    if (!body.as_expected && !body.discrepancy?.trim()) throw badRequest('Please describe the discrepancy.', { discrepancy: 'Required when the food was not received as expected.' });
    const when = body.delivery_time && !Number.isNaN(Date.parse(body.delivery_time)) ? new Date(body.delivery_time).toISOString() : nowIso();
    db.prepare(`UPDATE collections SET actual_delivery_time = ?, quantity_delivered = ?, received_as_expected = ?, discrepancy = ?, notes = ?,
      status = 'delivered', task_status = CASE WHEN assigned_volunteer_id IS NOT NULL THEN 'delivered' ELSE task_status END, updated_at = ? WHERE donation_id = ?`)
      .run(when, q, body.as_expected ? 1 : 0, body.discrepancy || null, body.notes || null, nowIso(), d.id);
    setStatus(db, d, 'delivered', user.id, `Receipt confirmed: ${q} ${d.unit}${body.as_expected ? '' : ' (discrepancy reported)'}`);
    notify(d.donor_id, 'Donation delivered', `${d.item_name} was delivered. ${q} ${d.unit} confirmed received.`, `/app/donations/${d.id}`, { type: 'donation', id: d.id });
    void acc;
    audit(user.id, 'donation.confirm_delivery', 'donation', d.id, null, { quantity: q, as_expected: body.as_expected });
    return { ok: true };
  });
}

export function markFailed(user: SessionUser, donationId: number, reason: string) {
  if (!reason?.trim()) throw badRequest('Please give a reason.', { reason: 'A reason is required.' });
  return tx((db) => {
    const d = mustGet(db, donationId);
    const { acc } = partyCheck(db, user, d);
    if (!['accepted', 'scheduled', 'collected'].includes(d.status)) throw conflict('Only an active collection can be marked failed.');
    db.prepare(`UPDATE collections SET status = 'failed', task_status = CASE WHEN assigned_volunteer_id IS NOT NULL THEN 'failed' ELSE task_status END,
      failure_reason = ?, updated_at = ? WHERE donation_id = ?`).run(reason, nowIso(), d.id);
    setStatus(db, d, 'failed', user.id, `Collection failed: ${reason}`);
    for (const uid of [d.donor_id, Number(acc?.recipient_id)].filter((x) => x && x !== user.id))
      notify(uid, 'Collection failed', `Collection of ${d.item_name} failed. Reason: ${reason}`, `/app/donations/${d.id}`, { type: 'donation', id: d.id });
    audit(user.id, 'collection.fail', 'donation', d.id, reason);
    return { ok: true };
  });
}

/** Admin correction outside the normal workflow — always audited with a reason. */
export function adminSetStatus(user: SessionUser, donationId: number, to: DonationStatus, reason: string) {
  if (user.role !== 'admin') throw forbidden();
  if (!reason?.trim()) throw badRequest('A reason is required for administrative corrections.', { reason: 'Required.' });
  return tx((db) => {
    const d = mustGet(db, donationId);
    const from = d.status;
    setStatus(db, d, to, user.id, `Administrative correction: ${reason}`, true);
    audit(user.id, 'donation.admin_status_change', 'donation', d.id, reason, { from, to });
    notify(d.donor_id, 'Donation updated by administrator', `${d.item_name} status changed from ${from} to ${to}. Reason: ${reason}`, `/app/donations/${d.id}`, { type: 'donation', id: d.id });
    return { ok: true };
  });
}

/* ---------- Donor-selected offers (PRD §12.3 step 7, §4.3 accept/decline offers) ---------- */

export function offerToRecipient(user: SessionUser, donationId: number, recipientUserId: number) {
  return tx((db) => {
    const d = ownDonation(db, user, donationId);
    if (d.status !== 'available' && d.status !== 'requested') throw conflict('Offers can only be made while the donation is available.');
    const rec = getOrgByUser(recipientUserId);
    if (!rec || rec.kind !== 'recipient' || rec.verification_status !== 'verified') throw badRequest('This organization is not eligible.');
    const existing = db.prepare('SELECT id, status FROM donation_requests WHERE donation_id = ? AND recipient_id = ?').get(d.id, recipientUserId);
    if (existing?.status === 'pending') throw conflict('This organization has already requested the donation — accept their request instead.');
    if (existing?.status === 'offered') throw conflict('An offer has already been sent to this organization.');
    if (existing) db.prepare(`UPDATE donation_requests SET status = 'offered', request_time = ?, decision_time = NULL WHERE id = ?`).run(nowIso(), existing.id);
    else db.prepare(`INSERT INTO donation_requests (donation_id, recipient_id, requested_quantity, status, request_time, notes) VALUES (?, ?, ?, 'offered', ?, 'Offered by donor')`)
      .run(d.id, recipientUserId, d.quantity_available, nowIso());
    db.prepare(`UPDATE donation_matches SET status = 'offered' WHERE donation_id = ? AND recipient_id = ?`).run(d.id, recipientUserId);
    db.prepare('INSERT INTO donation_status_history (donation_id, from_status, to_status, actor_user_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(d.id, d.status, d.status, user.id, `Offer sent to ${rec.organization_name}`, nowIso());
    notify(recipientUserId, 'Donation offered to you', `${d.item_name} (${d.quantity_available} ${d.unit}) has been offered to your organization. Please accept or decline.`, `/app/donations/${d.id}`, { type: 'donation', id: d.id });
    audit(user.id, 'match.select', 'donation', d.id, null, { recipient: recipientUserId });
    return { ok: true };
  });
}

export function respondToOffer(user: SessionUser, donationId: number, accept: boolean, reason?: string) {
  if (accept) requireVerified(user, 'accept donations');
  sweepDeadlines(true);
  return tx((db) => {
    const d = mustGet(db, donationId);
    const r = db.prepare(`SELECT * FROM donation_requests WHERE donation_id = ? AND recipient_id = ? AND status = 'offered'`).get(d.id, user.id);
    if (!r) throw notFound('No open offer for your organization.');
    const org = getOrgByUser(user.id)!;
    if (!accept) {
      db.prepare(`UPDATE donation_requests SET status = 'rejected', decision_time = ?, notes = ? WHERE id = ?`).run(nowIso(), reason ? `Declined: ${reason}` : 'Declined by recipient', r.id);
      db.prepare(`UPDATE donation_matches SET status = 'declined' WHERE donation_id = ? AND recipient_id = ?`).run(d.id, user.id);
      notify(d.donor_id, 'Offer declined', `${org.organization_name} declined the offer for ${d.item_name}.${reason ? ' Reason: ' + reason : ''}`, `/app/donations/${d.id}`, { type: 'donation', id: d.id });
      return { ok: true };
    }
    if (d.status !== 'available' && d.status !== 'requested') throw conflict('This donation is no longer available.');
    if (Date.parse(d.safe_until) <= Date.now()) throw conflict('This donation has passed its safe-use deadline.');
    if (d.status === 'available') setStatus(db, d, 'requested', user.id, `Offer accepted by ${org.organization_name}`);
    setStatus(db, d, 'accepted', user.id, `Offer accepted by ${org.organization_name}`);
    db.prepare(`UPDATE donation_requests SET status = 'accepted', decision_time = ? WHERE id = ?`).run(nowIso(), r.id);
    const others = db.prepare(`SELECT recipient_id FROM donation_requests WHERE donation_id = ? AND status IN ('pending','offered') AND id != ?`).all(d.id, r.id);
    db.prepare(`UPDATE donation_requests SET status = 'rejected', decision_time = ? WHERE donation_id = ? AND status IN ('pending','offered') AND id != ?`).run(nowIso(), d.id, r.id);
    db.prepare(`INSERT INTO collections (donation_id, request_id, task_status, status, created_at, updated_at) VALUES (?, ?, 'unassigned', 'pending', ?, ?)`).run(d.id, r.id, nowIso(), nowIso());
    notify(d.donor_id, 'Offer accepted', `${org.organization_name} accepted ${d.item_name}. Collection can now be scheduled.`, `/app/donations/${d.id}`, { type: 'donation', id: d.id });
    for (const o of others) notify(Number(o.recipient_id), 'Request not accepted', `Another organization was selected for ${d.item_name}.`, `/app/donations/${d.id}`, { type: 'donation', id: d.id });
    audit(user.id, 'donation.accept_offer', 'donation', d.id);
    return { ok: true };
  });
}

export function declineRecommendation(user: SessionUser, donationId: number) {
  getDb()
    .prepare(
      `INSERT INTO donation_matches (donation_id, recipient_id, compatibility_score, explanation, status, created_at)
       VALUES (?, ?, 0, 'Declined by recipient', 'declined', ?)
       ON CONFLICT(donation_id, recipient_id) DO UPDATE SET status = 'declined'`
    )
    .run(donationId, user.id, nowIso());
  return { ok: true };
}

/* ---------- Volunteer tasks (PRD §14) ---------- */

export function volunteerTask(user: SessionUser, donationId: number, action: 'claim' | 'accept' | 'decline' | 'at_pickup' | 'collected' | 'delivered' | 'failed', body: { quantity?: number; reason?: string } = {}) {
  if (user.role !== 'volunteer') throw forbidden();
  if (action === 'collected') return markCollected(user, donationId, body.quantity);
  if (action === 'failed') return markFailed(user, donationId, body.reason ?? '');
  return tx((db) => {
    const d = mustGet(db, donationId);
    const c = db.prepare('SELECT * FROM collections WHERE donation_id = ?').get(d.id);
    if (!c) throw notFound('Task not found.');
    const mine = c.assigned_volunteer_id != null && Number(c.assigned_volunteer_id) === user.id;
    const acc = db.prepare(`SELECT recipient_id FROM donation_requests WHERE donation_id = ? AND status = 'accepted'`).get(d.id);
    const set = (status: string, extra = '') =>
      db.prepare(`UPDATE collections SET task_status = ?, ${extra} updated_at = ? WHERE id = ?`).run(status, nowIso(), c.id);
    switch (action) {
      case 'claim':
        if (!c.needs_volunteer || c.assigned_volunteer_id != null || d.status !== 'scheduled') throw conflict('This task is no longer open.');
        db.prepare(`UPDATE collections SET assigned_volunteer_id = ?, task_status = 'accepted', updated_at = ? WHERE id = ? AND assigned_volunteer_id IS NULL`).run(user.id, nowIso(), c.id);
        notify(d.donor_id, 'Volunteer assigned', `${user.full_name} will collect ${d.item_name}.`, `/app/donations/${d.id}`, { type: 'donation', id: d.id });
        if (acc) notify(Number(acc.recipient_id), 'Volunteer assigned', `${user.full_name} will deliver ${d.item_name}.`, `/app/donations/${d.id}`, { type: 'donation', id: d.id });
        break;
      case 'accept':
        if (!mine || c.task_status !== 'assigned') throw conflict('This task cannot be accepted.');
        set('accepted');
        break;
      case 'decline':
        if (!mine || ['collected', 'delivered'].includes(String(c.task_status))) throw conflict('This task cannot be declined now.');
        db.prepare(`UPDATE collections SET assigned_volunteer_id = NULL, task_status = 'unassigned', updated_at = ? WHERE id = ?`).run(nowIso(), c.id);
        notify(d.donor_id, 'Volunteer unavailable', `The volunteer for ${d.item_name} declined the task. It is open again.`, `/app/donations/${d.id}`, { type: 'donation', id: d.id });
        break;
      case 'at_pickup':
        if (!mine || !['accepted', 'assigned'].includes(String(c.task_status))) throw conflict('Accept the task first.');
        set('at_pickup');
        break;
      case 'delivered': {
        if (!mine || d.status !== 'collected') throw conflict('Mark the food as collected first.');
        const q = Number(body.quantity);
        if (!(q >= 0) || q > d.quantity_available) throw badRequest('Enter the quantity delivered.', { quantity: `Enter 0–${d.quantity_available} ${d.unit}.` });
        db.prepare(`UPDATE collections SET task_status = 'delivered', quantity_delivered = ?, notes = COALESCE(?, notes), updated_at = ? WHERE id = ?`).run(q, body.reason ?? null, nowIso(), c.id);
        if (acc) notify(Number(acc.recipient_id), 'Please confirm receipt', `The volunteer reports delivering ${q} ${d.unit} of ${d.item_name}. Please confirm the quantity received.`, `/app/donations/${d.id}`, { type: 'donation', id: d.id });
        break;
      }
    }
    audit(user.id, `task.${action}`, 'donation', d.id);
    return { ok: true };
  });
}
