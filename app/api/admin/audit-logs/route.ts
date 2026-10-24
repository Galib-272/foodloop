import { apiUser, handle } from '@/lib/api';
import { auditLogs } from '@/lib/admin';

export const dynamic = 'force-dynamic';
export const GET = handle(async (req) => {
  apiUser(['admin']);
  const u = new URL(req.url);
  return { logs: auditLogs({ entity: u.searchParams.get('entity') ?? undefined, q: u.searchParams.get('q') ?? undefined }) };
});
