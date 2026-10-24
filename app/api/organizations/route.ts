import { getDb } from '@/lib/db';
import { apiUser, handle } from '@/lib/api';
import { parseOrg } from '@/lib/orgs';

export const dynamic = 'force-dynamic';

// Admin listing of organizations, filterable by kind and verification status.
export const GET = handle(async (req) => {
  apiUser(['admin']);
  const url = new URL(req.url);
  const kind = url.searchParams.get('kind');
  const status = url.searchParams.get('status');
  const where: string[] = [];
  const params: string[] = [];
  if (kind) { where.push('kind = ?'); params.push(kind); }
  if (status) { where.push('verification_status = ?'); params.push(status); }
  const rows = getDb()
    .prepare(`SELECT * FROM organizations ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`)
    .all(...params);
  return { organizations: rows.map((r) => parseOrg(r)) };
});
