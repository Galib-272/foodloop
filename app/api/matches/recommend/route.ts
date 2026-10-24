import { z } from 'zod';
import { apiUser, forbidden, handle, notFound, parseBody } from '@/lib/api';
import { getDonation, sweepDeadlines } from '@/lib/donations';
import { matchesForDonation, recommendationsForRecipient } from '@/lib/matching';
import { listDonations } from '@/lib/donation-queries';
import { getOrgByUser } from '@/lib/orgs';

export const dynamic = 'force-dynamic';

// Donor: ranked recipients for a donation. Recipient: ranked donations for their organization.
export const POST = handle(async (req) => {
  const user = apiUser(['donor', 'recipient', 'admin']);
  const b = await parseBody(req, z.object({ donation_id: z.coerce.number().int().positive().optional() }));
  if (user.role === 'recipient') {
    const org = getOrgByUser(user.id);
    if (!org) throw forbidden('Complete your organization profile first.');
    sweepDeadlines();
    const recs = recommendationsForRecipient(org, listDonations({ status: ['available', 'requested'], activeOnly: true, verifiedDonorOnly: true }));
    return { recommendations: recs.map((r) => ({ donation_id: r.donation.id, item_name: r.donation.item_name, score: r.match.score, explanation: r.match.explanation })) };
  }
  if (!b.donation_id) throw notFound('donation_id is required.');
  const d = getDonation(b.donation_id);
  if (!d) throw notFound();
  if (user.role !== 'admin' && d.donor_id !== user.id) throw forbidden();
  return matchesForDonation(d);
});
