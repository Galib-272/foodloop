import { apiUser, handle } from '@/lib/api';
import { listUsers } from '@/lib/admin';

export const dynamic = 'force-dynamic';
export const GET = handle(async (req) => {
  apiUser(['admin']);
  const u = new URL(req.url);
  return { users: listUsers({ q: u.searchParams.get('q') ?? undefined, role: u.searchParams.get('role') ?? undefined, verification: u.searchParams.get('verification') ?? undefined }) };
});
