import { getDb, nowIso } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { createSession } from '@/lib/auth';
import { conflict, handle, parseBody, rateLimit } from '@/lib/api';
import { registerSchema } from '@/lib/validation';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req) => {
  rateLimit(req, 'register', 10, 15 * 60_000);
  const data = await parseBody(req, registerSchema);
  const db = getDb();
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(data.email);
  if (exists) throw conflict('An account with this email already exists.');
  const now = nowIso();
  const id = Number(
    db
      .prepare(
        `INSERT INTO users (full_name, email, password_hash, role, phone, onboarded, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(data.full_name, data.email, hashPassword(data.password), data.role, data.phone || null,
        data.role === 'volunteer' ? 1 : 0, now, now).lastInsertRowid
  );
  audit(id, 'user.register', 'user', id, null, { role: data.role });
  createSession(id);
  return { ok: true, redirect: data.role === 'volunteer' ? '/app' : '/onboarding' };
});
