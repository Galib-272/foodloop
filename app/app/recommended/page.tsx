import Link from 'next/link';
import { DonationCard } from '@/components/app/donation-card';
import { ActionButton } from '@/components/app/action-button';
import { EmptyState, Notice, PageHeader } from '@/components/app/ui';
import { requireUser } from '@/lib/auth';
import { listDonations } from '@/lib/donation-queries';
import { getOrgByUser } from '@/lib/orgs';
import { recommendationsForRecipient } from '@/lib/matching';
import { redact, viewerFor } from '@/lib/donations';
import { Stagger } from '@/components/motion';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Recommended Matches — FoodSphere AI' };

export default function Recommended() {
  const user = requireUser(['recipient']);
  const org = getOrgByUser(user.id)!;
  const recs = recommendationsForRecipient(org, listDonations({ status: ['available', 'requested'], activeOnly: true, verifiedDonorOnly: true }));
  return (
    <>
      <PageHeader title="Recommended Matches" description="Donations ranked for your organization by the AI’s estimated chance of a successful delivery, then urgency — not just proximity." />
      <div className="mb-5"><Notice tone="info">Only donations you can safely accept, store and receive in time are shown. The match % is the AI model’s estimated chance of a successful delivery — an estimate from a model trained on synthetic data, not a guarantee.</Notice></div>
      {recs.length === 0 ? <EmptyState title="No recommendations right now">You will get a notification when a suitable donation is published.</EmptyState> : (
        <Stagger className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3" itemClassName="h-full" hover>
          {recs.map(({ donation, match }) => (
            <DonationCard key={donation.id} d={redact(donation, viewerFor(user, donation))} score={match.score} explanation={match.explanation} distance={match.distance_km}
              footer={<>
                <Link href={`/app/donations/${donation.id}`} className="text-sm font-semibold text-secondary hover:underline">View & request</Link>
                <span className="ml-auto"><ActionButton endpoint={`/api/donations/${donation.id}/decline-recommendation`} label="Decline" variant="ghost" success="Recommendation declined" /></span>
              </>} />
          ))}
        </Stagger>
      )}
    </>
  );
}
