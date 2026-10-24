import { z } from 'zod';
import { getDb, nowIso } from '@/lib/db';
import { hashPassword, sha256 } from '@/lib/password';
import { badRequest, handle, parseBody, rateLimit } from '@/lib/api';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const schema = z
  .object({
    token: z.string().min(10),
    password: z.string().min(8, 'Password must be at least 8 characters.').regex(/[A-Za-z]/, 'Password must contain a letter.').regex(/\d/, 'Password must contain a number.'),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, { path: ['confirm_password'], message: 'Passwords do not match.' });

export const POST = handle(async (req) => {
  rateLimit(req, 'reset', 10, 15 * 60_000);
  const data = await parseBody(req, schema);
  const db = getDb();
  const row = db
    .prepare('SELECT user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?')
    .get(sha256(data.token), nowIso());
  if (!row) throw badRequest('This reset link is invalid or has expired.');
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hashPassword(data.password), nowIso(), row.user_id);
  db.prepare('UPDATE password_resets SET used_at = ? WHERE token_hash = ?').run(nowIso(), sha256(data.token));
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
  audit(Number(row.user_id), 'user.password_reset', 'user', Number(row.user_id));
  return { ok: true };
});
