import { z } from 'zod';
import { getDb } from '@/lib/db';
import { apiUser, handle, parseBody } from '@/lib/api';
import { sweepDeadlines } from '@/lib/donations';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const user = apiUser();
  sweepDeadlines();
  const db = getDb();
  return {
    unread: Number(db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0').get(user.id)!.n),
    notifications: db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(user.id),
  };
});

export const PATCH = handle(async (req) => {
  const user = apiUser();
  const b = await parseBody(req, z.object({ ids: z.array(z.number().int()).optional(), all: z.boolean().optional() }));
  const db = getDb();
  if (b.all) db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(user.id);
  else for (const id of b.ids ?? []) db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id, user.id);
  return { ok: true };
});
