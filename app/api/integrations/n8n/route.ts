import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { ApiError, handle, parseBody } from '@/lib/api';
import { audit, notify } from '@/lib/audit';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

function secretOk(given: string | null) {
  const want = process.env.N8N_SHARED_SECRET;
  if (!want) throw new ApiError(503, 'not_configured', 'N8N_SHARED_SECRET is not set on this server.');
  const a = Buffer.from(given ?? '');
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Called by the n8n workflow for urgent events: every active administrator gets an in-app notification. */
export const POST = handle(async (req) => {
  if (!secretOk(req.headers.get('x-foodsphere-secret'))) throw new ApiError(401, 'unauthorized', 'Invalid automation secret.');
  const b = await parseBody(req, z.object({
    event: z.string().max(60),
    title: z.string().trim().min(1).max(120),
    message: z.string().trim().min(1).max(600),
    link: z.string().startsWith('/').max(200).optional().nullable(),
    donationId: z.number().int().positive().optional().nullable(),
  }));
  const admins = getDb().prepare(`SELECT id FROM users WHERE role = 'admin' AND account_status = 'active'`).all() as { id: number }[];
  for (const a of admins) {
    notify(Number(a.id), `[n8n] ${b.title}`, b.message, b.link ?? '/app/admin', b.donationId ? { type: 'donation', id: b.donationId } : undefined);
  }
  audit(null, 'automation.n8n_alert', b.donationId ? 'donation' : 'automation', b.donationId ?? null, null, { event: b.event, notified: admins.length });
  return { ok: true, notified: admins.length };
});
