import { z } from 'zod';
import { getDb, nowIso } from '@/lib/db';
import { apiUser, badRequest, handle, idParam, notFound, parseBody } from '@/lib/api';
import {
  acceptRequest, adminSetStatus, cancelDonation, confirmDelivery, declineRecommendation, getDonation, markCollected, markFailed,
  offerToRecipient, rejectRequest, requestDonation, respondToOffer, scheduleCollection, volunteerTask, withdrawRequest,
} from '@/lib/donations';
import { DONATION_STATUSES } from '@/lib/constants';
import { audit, notify } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const reqId = z.object({ request_id: z.coerce.number().int().positive() });
const reason = z.object({ reason: z.string().trim().max(500).optional().default('') });

export const POST = handle<{ params: { id: string; action: string } }>(async (req, { params }) => {
  const id = idParam(params.id);
  if (!getDonation(id)) throw notFound('Donation not found.');
  const body = async <T,>(s: z.ZodSchema<T>) => parseBody(req, s);

  switch (params.action) {
    case 'request': {
      const u = apiUser(['recipient']);
      const b = await body(z.object({ notes: z.string().trim().max(500).optional() }));
      return requestDonation(u, id, b.notes);
    }
    case 'withdraw':
      return withdrawRequest(apiUser(['recipient']), id);
    case 'accept': {
      const u = apiUser(['donor', 'admin']);
      return acceptRequest(u, id, (await body(reqId)).request_id);
    }
    case 'reject': {
      const u = apiUser(['donor', 'admin']);
      const b = await body(reqId.merge(reason));
      return rejectRequest(u, id, b.request_id, b.reason || undefined);
    }
    case 'cancel':
      return cancelDonation(apiUser(['donor', 'admin']), id, (await body(reason)).reason ?? '');
    case 'offer': {
      const u = apiUser(['donor']);
      const b = await body(z.object({ recipient_id: z.coerce.number().int().positive() }));
      return offerToRecipient(u, id, b.recipient_id);
    }
    case 'respond-offer': {
      const u = apiUser(['recipient']);
      const b = await body(z.object({ accept: z.boolean(), reason: z.string().trim().max(300).optional() }));
      return respondToOffer(u, id, b.accept, b.reason);
    }
    case 'decline-recommendation':
      return declineRecommendation(apiUser(['recipient']), id);
    case 'schedule': {
      const u = apiUser(['donor', 'recipient', 'admin']);
      const b = await body(z.object({ pickup_time: z.string().min(1, 'Choose a pickup time.'), needs_volunteer: z.boolean().optional() }));
      return scheduleCollection(u, id, b.pickup_time, !!b.needs_volunteer);
    }
    case 'collected': {
      const u = apiUser(['donor', 'recipient', 'volunteer', 'admin']);
      const b = await body(z.object({ quantity: z.coerce.number().positive().optional() }));
      return markCollected(u, id, b.quantity);
    }
    case 'confirm-delivery': {
      const u = apiUser(['recipient', 'admin']);
      const b = await body(z.object({
        quantity_received: z.coerce.number().min(0, 'Cannot be negative.'),
        delivery_time: z.string().optional(),
        as_expected: z.boolean(),
        discrepancy: z.string().trim().max(500).optional(),
        notes: z.string().trim().max(500).optional(),
      }));
      return confirmDelivery(u, id, b);
    }
    case 'failed': {
      const u = apiUser(['donor', 'recipient', 'volunteer', 'admin']);
      return markFailed(u, id, (await body(reason)).reason ?? '');
    }
    case 'task': {
      const u = apiUser(['volunteer']);
      const b = await body(z.object({
        action: z.enum(['claim', 'accept', 'decline', 'at_pickup', 'collected', 'delivered', 'failed']),
        quantity: z.coerce.number().min(0).optional(),
        reason: z.string().trim().max(500).optional(),
      }));
      return volunteerTask(u, id, b.action, { quantity: b.quantity, reason: b.reason });
    }
    case 'report': {
      const u = apiUser();
      const b = await body(z.object({ reason: z.string().trim().min(3, 'Choose a reason.').max(120), details: z.string().trim().max(1000).optional() }));
      const rid = Number(getDb().prepare(`INSERT INTO reports (donation_id, reporter_id, reason, details, status, created_at) VALUES (?, ?, ?, ?, 'open', ?)`)
        .run(id, u.id, b.reason, b.details || null, nowIso()).lastInsertRowid);
      for (const a of getDb().prepare(`SELECT id FROM users WHERE role = 'admin' AND account_status = 'active'`).all())
        notify(Number(a.id), 'Donation reported', `Donation D-${String(id).padStart(4, '0')} was reported: ${b.reason}`, '/app/admin/reports', { type: 'report', id: rid });
      audit(u.id, 'donation.report', 'donation', id, b.reason);
      return { ok: true };
    }
    case 'admin-status': {
      const u = apiUser(['admin']);
      const b = await body(z.object({ status: z.enum(DONATION_STATUSES), reason: z.string().trim().min(3, 'A reason is required.').max(500) }));
      return adminSetStatus(u, id, b.status, b.reason);
    }
    default:
      throw badRequest('Unknown action.');
  }
});
