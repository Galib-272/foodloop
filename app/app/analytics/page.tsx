import { CheckCircle2, Download, Package, Percent, Trash2, XCircle } from 'lucide-react';
import { Stagger } from '@/components/motion';
import { Button } from '@/components/ui/button';
import { Card, PageHeader, StatCard } from '@/components/app/ui';
import { MonthlyChart, SimpleBars } from '@/components/app/charts';
import { MetricDefinitions } from '@/components/app/metric-definitions';
import { requireUser } from '@/lib/auth';
import { donorAnalytics, formatTotals, recipientAnalytics } from '@/lib/analytics';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Impact Analytics — FoodSphere AI' };

const pct = (r: number | null) => (r == null ? '—' : `${Math.round(r * 100)}%`);

export default function AnalyticsPage() {
  const user = requireUser(['donor', 'recipient']);
  const exportBtn = <Button asChild variant="outline"><a href="/api/analytics/export"><Download className="mr-2 h-4 w-4" />Export impact report (CSV)</a></Button>;
  if (user.role === 'donor') {
    const a = donorAnalytics(user.id);
    return (
      <>
        <PageHeader title="Impact Analytics" description="Calculated only from your stored, confirmed records." actions={exportBtn} />
        <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" itemClassName="h-full">
          <StatCard label="Total quantity donated" icon={Package} value={formatTotals(a.donated)} hint="Published, excluding cancelled" />
          <StatCard label="Successfully delivered" icon={CheckCircle2} tone="green" value={formatTotals(a.delivered)} hint="Confirmed by recipients" />
          <StatCard label="Completed donations" icon={CheckCircle2} tone="green" value={a.statuses.delivered ?? 0} />
          <StatCard label="Donation completion rate" icon={Percent} value={pct(a.fulfillment.rate)} hint={`${a.fulfillment.done} of ${a.fulfillment.eligible} accepted donations`} />
          <StatCard label="Recorded food waste" icon={Trash2} tone="amber" value={formatTotals(a.waste30)} hint="Last 30 days" />
        </Stagger>
        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2" title="Monthly donation trends" description="Kilograms published vs confirmed delivered">
            <MonthlyChart data={a.monthly} />
          </Card>
          <Card title="Most frequently donated categories" description="Number of donations">
            <SimpleBars horizontal data={a.categories.map((c) => ({ name: c.category, value: c.count }))} height={260} />
          </Card>
        </div>
        <div className="mt-6"><MetricDefinitions /></div>
      </>
    );
  }
  const r = recipientAnalytics(user.id);
  return (
    <>
      <PageHeader title="Impact Report" description="Food your organization has received, calculated from confirmed receipts." actions={exportBtn} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Quantity received" icon={Package} tone="green" value={formatTotals(r.received)} hint="Confirmed on receipt" />
        <StatCard label="Completed donations" icon={CheckCircle2} tone="green" value={r.completed} />
        <StatCard label="Categories received" icon={Package} value={r.categories.length} />
        <StatCard label="Failed or cancelled" icon={XCircle} tone="red" value={r.failedOrCancelled} hint="Including expired after acceptance" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Monthly receiving trend" description="Kilograms confirmed received">
          <MonthlyChart data={r.monthly.map((m) => ({ month: m.month, delivered: m.delivered }))} labels={{ delivered: 'Received (confirmed)' }} />
        </Card>
        <Card title="Donation categories received" description="Number of delivered donations">
          <SimpleBars horizontal data={r.categories.map((c) => ({ name: c.category, value: c.count }))} height={260} />
        </Card>
      </div>
      <div className="mt-6"><MetricDefinitions /></div>
    </>
  );
}
