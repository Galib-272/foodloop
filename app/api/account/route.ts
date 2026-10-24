import { z } from 'zod';
import { getDb, nowIso } from '@/lib/db';
import { apiUser, badRequest, handle, parseBody } from '@/lib/api';
import { hashPassword, verifyPassword } from '@/lib/password';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const schema = z.object({
  full_name: z.string().trim().min(2, 'Full name is required.').max(100),
  phone: z.string().trim().max(20).regex(/^$|^\+?[0-9\s-]{7,20}$/, 'Enter a valid phone number.').optional(),
  current_password: z.string().optional(),
  new_password: z.string().optional(),
});

export const PATCH = handle(async (req) => {
  const user = apiUser();
  const b = await parseBody(req, schema);
  const db = getDb();
  if (b.new_password) {
    if (b.new_password.length < 8 || !/[A-Za-z]/.test(b.new_password) || !/\d/.test(b.new_password))
      throw badRequest('Please correct the highlighted fields.', { new_password: 'At least 8 characters, with a letter and a number.' });
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id)!;
    if (!b.current_password || !verifyPassword(b.current_password, String(row.password_hash)))
      throw badRequest('Please correct the highlighted fields.', { current_password: 'Current password is incorrect.' });
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(b.new_password), user.id);
    audit(user.id, 'user.password_change', 'user', user.id);
  }
  db.prepare('UPDATE users SET full_name = ?, phone = ?, updated_at = ? WHERE id = ?').run(b.full_name, b.phone || null, nowIso(), user.id);
  return { ok: true };
});
