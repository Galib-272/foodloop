import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb, nowIso } from './db';
import { randomToken, sha256 } from './password';
import type { Role } from './constants';

export const SESSION_COOKIE = 'fs_session';
const SESSION_DAYS = 7;

export type SessionUser = {
  id: number;
  full_name: string;
  email: string;
  role: Role;
  account_status: 'active' | 'suspended';
  phone: string | null;
  onboarded: number;
  org_id: number | null;
  org_name: string | null;
  verification_status: string | null;
};

/** Secure cookies only when actually served over HTTPS (so `npm start` on http://localhost still works). */
function isHttps() {
  const h = headers();
  const proto = h.get('x-forwarded-proto');
  if (proto) return proto.split(',')[0].trim() === 'https';
  const host = h.get('host') ?? '';
  return process.env.NODE_ENV === 'production' && !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
}

export function createSession(userId: number) {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  getDb()
    .prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(sha256(token), userId, expires.toISOString(), nowIso());
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps(),
    path: '/',
    expires,
  });
}

export function destroySession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  cookies().delete(SESSION_COOKIE);
}

export function getCurrentUser(): SessionUser | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT u.id, u.full_name, u.email, u.role, u.account_status, u.phone, u.onboarded,
              o.id AS org_id, o.organization_name AS org_name, o.verification_status
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN organizations o ON o.user_id = u.id
       WHERE s.token_hash = ? AND s.expires_at > ?`
    )
    .get(sha256(token), nowIso());
  if (!row) return null;
  return row as unknown as SessionUser;
}

/** For server components/pages: redirects instead of throwing. */
export function requireUser(roles?: Role[]): SessionUser {
  const user = getCurrentUser();
  if (!user) redirect('/login');
  if (user.account_status === 'suspended') redirect('/login?suspended=1');
  if (roles && !roles.includes(user.role)) redirect('/app?denied=1');
  return user;
}

export function homeFor(role: Role): string {
  switch (role) {
    case 'admin':
      return '/app/admin';
    default:
      return '/app';
  }
}
