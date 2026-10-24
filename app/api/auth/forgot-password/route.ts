import { z } from 'zod';
import { getDb } from '@/lib/db';
import { randomToken, sha256 } from '@/lib/password';
import { handle, parseBody, rateLimit } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req) => {
  rateLimit(req, 'forgot', 5, 15 * 60_000);
  const { email } = await parseBody(req, z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email address.') }));
  const user = getDb().prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (user) {
    const token = randomToken();
    getDb()
      .prepare('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
      .run(sha256(token), user.id, new Date(Date.now() + 3600_000).toISOString());
    // No email service is configured. In development the link is printed to the server terminal only.
    const origin = new URL(req.url).origin;
    console.log(`\n[FoodSphere] Password reset link for ${email} (valid 1 hour):\n${origin}/reset-password?token=${token}\n`);
  }
  // Always respond the same way so the endpoint does not reveal which emails exist.
  return { ok: true, message: 'If an account exists for that email, a reset link has been sent.' };
});
