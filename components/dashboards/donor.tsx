import Link from 'next/link';
import { Stagger, StaggerItem, StaggerList } from '@/components/motion';
import { AlertTriangle, ArrowRight, CheckCircle2, HandHeart, LineChart, Plus, Trash2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, DeadlineBadge, EmptyState, PageHeader, StatCard, StatusBadge, Table, VerificationBadge } from '@/components/app/ui';
import { SimpleBars, SurplusChart } from '@/components/app/charts';
import { donorDashboard } from '@/lib/dashboard';
import { formatTotals } from '@/lib/analytics';
import { did, fmtDate, fmtDateTime, qty } from '@/lib/format';
import { DONATION_STATUS_LABEL } from '@/lib/constants';
import type { SessionUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

export function DonorDashboard({ user }: { user: SessionUser }) {
  const d = donorDashboard(user.id);
  const s = d.analytics.statuses;
  const hour = Number(new Date().toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', hour12: false }));
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const statusData = [
    ['Available', s.available ?? 0], ['Requested', s.requested ?? 0], ['Accepted', (s.accepted ?? 0) + (s.scheduled ?? 0)],
    ['Collected', s.collected ?? 0], ['Delivered', s.delivered ?? 0], ['Cancelled / Expired', (s.cancelled ?? 0) + (s.expired ?? 0) + (s.failed ?? 0)],
  ].map(([name, value]) => ({ name: String(name), value: Number(value) }));

  return (
    <>
      <PageHeader
        eyebrow={d.org.organization_name}
        title={`${greet}, ${user.full_name.split(' ')[0]}`}
        description={<span className="inline-flex flex-wrap items-center gap-2">Here is today’s overview for your business. <VerificationBadge status={d.org.verification_status} /></span>}
        actions={
          <>
            <Button asChild variant="outline"><Link href="/app/forecast"><LineChart className="mr-2 h-4 w-4" />Run forecast</Link></Button>
            <Button asChild><Link href="/app/donations/new"><Plus className="mr-2 h-4 w-4" />Create donation</Link></Button>
          </>
        }
      />

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" itemClassName="h-full">
        <StatCard label="Predicted Leftover Today" icon={LineChart} tone={d.chart.next?.level === 'High' ? 'red' : 'green'} href="/app/forecast"
          value={d.chart.next ? `${d.chart.next.lower}–${d.chart.next.upper} units` : '—'}
          hint={d.chart.next ? `Waste risk: ${d.chart.next.level} · AI estimate for ${fmtDate(d.chart.next.date)}` : 'Forecasting unavailable'} />
        <StatCard label="Active Donations" icon={HandHeart} value={d.active.length} hint="Available to collected" href="/app/donations" />
        <StatCard label="Completed Donations" icon={CheckCircle2} tone="green" value={s.delivered ?? 0} hint={`${formatTotals(d.analytics.delivered)} confirmed delivered`} href="/app/history" />
        <StatCard label="Food Waste Recorded" icon={Trash2} tone="amber" value={formatTotals(d.analytics.waste30)} hint="Last 30 days, from your records" href="/app/inventory" />
      </Stagger>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Leftover: actual vs AI estimate" description="Daily leftover in units (purchase − sold), all categories. The dashed line is the model’s estimate; future days show an 80% range."
          action={<Link href="/app/forecast" className="text-sm font-medium text-secondary hover:underline">Details</Link>}>
          {d.chart.points.length ? <SurplusChart data={d.chart.points} unit="units" /> : <EmptyState title="No history yet" action={<Button asChild size="sm"><Link href="/app/import">Import CSV</Link></Button>}>Import your sales history to see trends and forecasts.</EmptyState>}
          {d.chart.points.length > 0 && !d.chart.forecastOk && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><Info className="h-3.5 w-3.5" />Forecasting is unavailable right now; historical data and donations still work.</p>
          )}
        </Card>
        <Card title="Recommended actions" description="Based on your current records">
          {d.actions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing needs your attention right now.</p>
          ) : (
            <StaggerList className="space-y-3">
              {d.actions.slice(0, 6).map((a, i) => (
                <StaggerItem key={i}>
                  <Link href={a.href} className="group flex gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/60">
                    <span className={cn('mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full', a.tone === 'red' && 'bg-red-600', a.tone === 'amber' && 'bg-amber-500', a.tone === 'green' && 'bg-green-600', a.tone === 'blue' && 'bg-blue-600')} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 text-sm font-semibold">{a.tone === 'red' && <AlertTriangle className="h-3.5 w-3.5 text-red-600" aria-label="Urgent" />}{a.title}</span>
                      <span className="block text-xs text-muted-foreground">{a.detail}</span>
                    </span>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </Link>
                </StaggerItem>
              ))}
            </StaggerList>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Donation status" description="All-time counts">
          <SimpleBars data={statusData} horizontal height={250} />
        </Card>
        <div className="xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Recent donations</h2>
            <Link href="/app/donations" className="text-sm font-medium text-secondary hover:underline">View all</Link>
          </div>
          <Table head={['Donation ID', 'Food Category', 'Quantity', 'Safe-Use Deadline', 'Status', 'Actions']}
            empty={d.recent.length === 0 ? <div className="p-6"><EmptyState title="No donations yet" action={<Button asChild size="sm"><Link href="/app/donations/new">Create donation</Link></Button>}>Publish your first surplus donation.</EmptyState></div> : null}>
            {d.recent.map((r) => (
              <tr key={r.id} className="hover:bg-muted/40">
                <td className="px-4 py-3 font-mono text-xs font-semibold">{did(r.id)}</td>
                <td className="px-4 py-3"><span className="font-medium">{r.item_name}</span><span className="block text-xs text-muted-foreground">{r.food_category}</span></td>
                <td className="px-4 py-3">{qty(r.quantity_available, r.unit)}</td>
                <td className="px-4 py-3">
                  <span className="block">{fmtDateTime(r.safe_until)}</span>
                  {['available', 'requested', 'accepted', 'scheduled'].includes(r.status) && <DeadlineBadge iso={r.safe_until} />}
                </td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3"><Link href={`/app/donations/${r.id}`} className="text-sm font-medium text-secondary hover:underline" aria-label={`View ${did(r.id)} (${DONATION_STATUS_LABEL[r.status]})`}>View</Link></td>
              </tr>
            ))}
          </Table>
        </div>
      </div>
    </>
  );
}
