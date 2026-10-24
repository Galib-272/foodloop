import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, DeadlineBadge, EmptyState, PageHeader, StatusBadge } from '@/components/app/ui';
import { MatchCard } from '@/components/donations/match-card';
import { requireUser } from '@/lib/auth';
import { listDonations } from '@/lib/donation-queries';
import { matchesForDonation } from '@/lib/matching';
import { did, qty } from '@/lib/format';
import { Stagger } from '@/components/motion';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Recipient Matches — FoodSphere AI' };

export default function Matches() {
  const user = requireUser(['donor']);
  const open = listDonations({ donorId: user.id, status: ['available', 'requested'], activeOnly: true });
  return (
    <>
      <PageHeader title="Recipient Matches" description="For each open donation, verified organizations that can accept it in time, ranked by the AI’s estimated chance of a successful delivery (after safety rules)." />
      {open.length === 0 ? (
        <EmptyState title="No open donations" action={<Button asChild size="sm"><Link href="/app/donations/new">Create donation</Link></Button>}>Matches appear here once you publish a donation.</EmptyState>
      ) : (
        <div className="space-y-6">
          {open.map((d) => {
            const { matches, excluded } = matchesForDonation(d);
            return (
              <Card key={d.id}
                title={<span className="flex flex-wrap items-center gap-2"><Link href={`/app/donations/${d.id}`} className="hover:underline">{d.item_name}</Link><span className="font-mono text-xs font-normal text-muted-foreground">{did(d.id)}</span><StatusBadge status={d.status} /></span>}
                description={<span className="flex flex-wrap items-center gap-2">{d.food_category} · {qty(d.quantity_available, d.unit)} · <DeadlineBadge iso={d.safe_until} /></span>}
                action={<span className="text-xs text-muted-foreground">{matches.length} eligible · {excluded.length} excluded</span>}>
                {matches.length === 0 ? <p className="text-sm text-muted-foreground">No eligible recipients right now.</p> : (
                  <Stagger className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3" itemClassName="h-full">
                    {matches.slice(0, 3).map((m) => <MatchCard key={m.recipient_user_id} m={m} donationId={d.id} unit={d.unit} canSelect />)}
                  </Stagger>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
