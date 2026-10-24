import { getDb } from '@/lib/db';
import { apiUser, forbidden, handle, idParam, notFound } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = handle<{ params: { id: string } }>(async (_req, { params }) => {
  const user = apiUser(['donor', 'admin']);
  const f = getDb().prepare('SELECT * FROM forecast_records WHERE id = ?').get(idParam(params.id));
  if (!f) throw notFound();
  if (user.role !== 'admin' && Number(f.donor_id) !== user.id) throw forbidden();
  return { forecast: f };
});
