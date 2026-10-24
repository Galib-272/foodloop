import Link from 'next/link';
import { Stagger } from '@/components/motion';
import { CheckCircle2, ClipboardList, HandHeart, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, Notice, PageHeader, StatCard, StatusBadge, VerificationBadge } from '@/components/app/ui';
import { DonationCard } from '@/components/app/donation-card';
import { ActionButton } from '@/components/app/action-button';
import { recipientDashboard } from '@/lib/dashboard';
import { did, fmtDateTime, qty } from '@/lib/format';
import type { SessionUser } from '@/lib/auth';

export function RecipientDashboard({ user }: { user: SessionUser }) {
  const d = recipientDashboard(user.id);
  const verified = d.org.verification_status === 'verified';
  return (
    <>
      <PageHeader eyebrow={d.org.organization_name} title={`Welcome, ${user.full_name.split(' ')[0]}`}
        description={<span className="inline-flex flex-wrap items-center gap-2">{d.org.organization_type} · {d.org.area} <VerificationBadge status={d.org.verification_status} /></span>}
        actions={<Button asChild><Link href="/app/available">Browse donations</Link></Button>} />

      {!verified && (
        <div className="mb-6"><Notice tone="warning" title="Verification pending">You can browse donations, but only verified organizations can request them. An administrator will review your details.</Notice></div>
      )}

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" itemClassName="h-full">
        <StatCard label="Available Matching Donations" icon={HandHeart} tone="green" value={d.recs.length} hint="Eligible for your organization" href="/app/recommended" />
        <StatCard label="Pending Requests" icon={ClipboardList} value={d.pendingCount} hint="Waiting for donor decision" href="/app/requests" />
        <StatCard label="Accepted Donations" icon={Truck} tone="amber" value={d.activeCol.length} hint="To collect" href="/app/collections" />
        <StatCard label="Completed Receipts" icon={CheckCircle2} tone="green" value={d.completed} hint="Delivery confirmed" href="/app/received" />
      </Stagger>

      {d.offers.length > 0 && (
        <Card className="mt-6 border-secondary" title="Donations offered to you" description="A donor selected your organization. Please accept or decline.">
          <ul className="divide-y">
            {d.offers.map((o) => (
              <li key={o.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link href={`/app/donations/${o.donation_id}`} className="font-semibold hover:underline">{o.item_name}</Link>
                  <p className="text-sm text-muted-foreground">{qty(o.quantity_available, o.unit)} from {o.donor_org} · safe until {fmtDateTime(o.safe_until)}</p>
                </div>
                <div className="flex gap-2">
                  <ActionButton endpoint={`/api/donations/${o.donation_id}/respond-offer`} body={{ accept: true }} label="Accept" success="Offer accepted" />
                  <ActionButton endpoint={`/api/donations/${o.donation_id}/respond-offer`} body={{ accept: false }} label="Decline" variant="outline"
                    confirm={{ title: 'Decline this offer?', reason: { label: 'Reason (optional)' }, confirmLabel: 'Decline' }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Top recommended donations</h2>
            <Link href="/app/recommended" className="text-sm font-medium text-secondary hover:underline">See all</Link>
          </div>
          {d.recs.length === 0 ? (
            <EmptyState title="No matching donations right now">We will notify you when a suitable donation is published.</EmptyState>
          ) : (
            <Stagger className="grid gap-4 md:grid-cols-2" itemClassName="h-full" hover>
              {d.recs.slice(0, 4).map(({ donation, match }) => (
                <DonationCard key={donation.id} d={donation} score={match.score} explanation={match.explanation} distance={match.distance_km} />
              ))}
            </Stagger>
          )}
        </div>
        <Card title="Active collections" action={<Link href="/app/collections" className="text-sm font-medium text-secondary hover:underline">All</Link>}>
          {d.activeCol.length === 0 ? <p className="text-sm text-muted-foreground">No active collections.</p> : (
            <ul className="space-y-3">
              {d.activeCol.map((c) => (
                <li key={c.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/app/donations/${c.donation_id}`} className="font-medium hover:underline">{c.item_name}</Link>
                    <StatusBadge status={String(c.donation_status)} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{did(Number(c.donation_id))} · {qty(Number(c.quantity_available), String(c.unit))} · {c.donor_org}</p>
                  <p className="mt-1 text-xs">{c.scheduled_pickup_time ? `Pickup ${fmtDateTime(String(c.scheduled_pickup_time))}` : 'Pickup not scheduled yet'}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
