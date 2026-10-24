import { apiUser, forbidden, handle, idParam, notFound } from '@/lib/api';
import { getDonation } from '@/lib/donations';
import { matchesForDonation, WEIGHTS } from '@/lib/matching';

export const dynamic = 'force-dynamic';

export const GET = handle<{ params: { id: string } }>(async (_req, { params }) => {
  const user = apiUser(['donor', 'admin']);
  const d = getDonation(idParam(params.id));
  if (!d) throw notFound();
  if (user.role !== 'admin' && d.donor_id !== user.id) throw forbidden();
  return { ...matchesForDonation(d), weights: WEIGHTS };
});
