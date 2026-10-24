import { getDb } from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import { createSession, homeFor } from '@/lib/auth';
import { ApiError, handle, parseBody, rateLimit } from '@/lib/api';
import { loginSchema } from '@/lib/validation';
import type { Role } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req) => {
  rateLimit(req, 'login', 10, 5 * 60_000);
  const data = await parseBody(req, loginSchema);
  const user = getDb()
    .prepare('SELECT id, password_hash, role, account_status, onboarded FROM users WHERE email = ?')
    .get(data.email);
  // Same message for unknown email and wrong password.
  if (!user || !verifyPassword(data.password, String(user.password_hash))) {
    throw new ApiError(401, 'invalid_credentials', 'Incorrect email or password.');
  }
  if (user.account_status === 'suspended') {
    throw new ApiError(403, 'suspended', 'This account is suspended. Please contact support.');
  }
  createSession(Number(user.id));
  const role = user.role as Role;
  const redirect = !user.onboarded && (role === 'donor' || role === 'recipient') ? '/onboarding' : homeFor(role);
  return { ok: true, redirect };
});
