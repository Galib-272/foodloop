import Link from 'next/link';
import { Truck } from 'lucide-react';
import { DeadlineBadge, EmptyState, PageHeader, StatusBadge } from '@/components/app/ui';
import { requireUser } from '@/lib/auth';
import { recipientRequests } from '@/lib/recipient-queries';
import { did, fmtDateTime, qty } from '@/lib/format';
import { Stagger } from '@/components/motion';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Active Collections — FoodSphere AI' };

const NEXT: Record<string, string> = { accepted: 'Schedule a pickup time', scheduled: 'Collect the food, then mark it collected', collected: 'Confirm the quantity received' };

export default function Collections() {
  const user = requireUser(['recipient']);
  const rows = recipientRequests(user.id).filter((r) => r.status === 'accepted' && ['accepted', 'scheduled', 'collected'].includes(String(r.donation_status)));
  return (
    <>
      <PageHeader title="Active Collections" description="Accepted donations you still need to collect or confirm." />
      {rows.length === 0 ? <EmptyState icon={Truck} title="No active collections">Accepted donations will appear here.</EmptyState> : (
        <Stagger className="grid gap-4 lg:grid-cols-2" itemClassName="h-full" hover>
          {rows.map((r) => (
            <article key={r.id} className="h-full rounded-xl border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/app/donations/${r.donation_id}`} className="text-lg font-semibold hover:underline">{r.item_name}</Link>
                  <p className="text-sm text-muted-foreground">{did(Number(r.donation_id))} · {qty(Number(r.quantity_available), String(r.unit))} · {r.donor_org}</p>
                </div>
                <StatusBadge status={String(r.donation_status)} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-muted-foreground">Pickup</dt><dd className="font-medium">{r.scheduled_pickup_time ? fmtDateTime(String(r.scheduled_pickup_time)) : 'Not scheduled'}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Collect before</dt><dd className="font-medium">{fmtDateTime(String(r.safe_until))}</dd><DeadlineBadge iso={String(r.safe_until)} /></div>
                {Number(r.needs_volunteer) === 1 && <div className="col-span-2"><dt className="text-xs text-muted-foreground">Volunteer</dt><dd className="font-medium">{r.volunteer_name ?? 'Waiting for a volunteer'}</dd></div>}
              </dl>
              <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3">
                <p className="text-sm"><span className="text-muted-foreground">Next step: </span>{NEXT[String(r.donation_status)]}</p>
                <Link href={`/app/donations/${r.donation_id}`} className="text-sm font-semibold text-secondary hover:underline">Open</Link>
              </div>
            </article>
          ))}
        </Stagger>
      )}
    </>
  );
}
