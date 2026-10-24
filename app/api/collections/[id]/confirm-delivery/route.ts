import { z } from 'zod';
import { getDb } from '@/lib/db';
import { apiUser, handle, idParam, notFound, parseBody } from '@/lib/api';
import { confirmDelivery } from '@/lib/donations';

export const dynamic = 'force-dynamic';

export const POST = handle<{ params: { id: string } }>(async (req, { params }) => {
  const user = apiUser(['recipient', 'admin']);
  const c = getDb().prepare('SELECT donation_id FROM collections WHERE id = ?').get(idParam(params.id));
  if (!c) throw notFound('Collection not found.');
  const b = await parseBody(req, z.object({
    quantity_received: z.coerce.number().min(0),
    delivery_time: z.string().optional(),
    as_expected: z.boolean(),
    discrepancy: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(500).optional(),
  }));
  return confirmDelivery(user, Number(c.donation_id), b);
});
