import { apiUser, handle } from '@/lib/api';
import { listDonations } from '@/lib/donation-queries';

export const dynamic = 'force-dynamic';
export const GET = handle(async (req) => {
  apiUser(['admin']);
  const u = new URL(req.url);
  return { donations: listDonations({ status: u.searchParams.get('status')?.split(',').filter(Boolean), category: u.searchParams.get('category') || undefined, q: u.searchParams.get('q') || undefined }) };
});
