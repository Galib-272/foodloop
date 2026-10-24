import { z } from 'zod';
import { getDb } from '@/lib/db';
import { apiUser, handle, idParam, notFound, parseBody } from '@/lib/api';
import { markCollected, markFailed, volunteerTask } from '@/lib/donations';

export const dynamic = 'force-dynamic';

export const PATCH = handle<{ params: { id: string } }>(async (req, { params }) => {
  const user = apiUser(['donor', 'recipient', 'volunteer', 'admin']);
  const c = getDb().prepare('SELECT donation_id FROM collections WHERE id = ?').get(idParam(params.id));
  if (!c) throw notFound('Collection not found.');
  const b = await parseBody(req, z.object({ status: z.enum(['accepted', 'at_pickup', 'collected', 'delivered', 'failed', 'claim', 'decline']), quantity: z.coerce.number().min(0).optional(), reason: z.string().trim().max(500).optional() }));
  const donationId = Number(c.donation_id);
  if (user.role === 'volunteer') return volunteerTask(user, donationId, b.status === 'accepted' ? 'accept' : (b.status as 'claim'), { quantity: b.quantity, reason: b.reason });
  if (b.status === 'collected') return markCollected(user, donationId, b.quantity);
  if (b.status === 'failed') return markFailed(user, donationId, b.reason ?? '');
  return { ok: false };
});
