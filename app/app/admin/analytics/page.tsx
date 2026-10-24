import { Building2, HandHeart, Package, Percent, Store } from 'lucide-react';
import { Stagger } from '@/components/motion';
import { Card, PageHeader, StatCard, Table } from '@/components/app/ui';
import { MonthlyChart, SimpleBars } from '@/components/app/charts';
import { MetricDefinitions } from '@/components/app/metric-definitions';
import { formatTotals, platformAnalytics } from '@/lib/analytics';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Platform Analytics — FoodSphere AI' };

export default function PlatformAnalytics() {
  const p = platformAnalytics();
  return (
    <>
      <PageHeader title="Platform Analytics" description="Platform-wide figures calculated from confirmed records."
        actions={<Button asChild variant="outline"><a href="/api/analytics/export"><Download className="mr-2 h-4 w-4" />Export (CSV)</a></Button>} />
      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" itemClassName="h-full">
        <StatCard label="Verified donors" icon={Store} value={p.verifiedDonors} />
        <StatCard label="Verified recipients" icon={Building2} value={p.verifiedRecipients} />
        <StatCard label="Published donations" icon={HandHeart} value={p.published} />
        <StatCard label="Delivered quantity" icon={Package} tone="green" value={formatTotals(p.delivered)} hint="Confirmed by recipients" />
        <StatCard label="Fulfillment rate" icon={Percent} tone="green" value={p.fulfillment.rate == null ? '—' : `${Math.round(p.fulfillment.rate * 100)}%`} hint={`${p.fulfillment.done} of ${p.fulfillment.eligible} accepted requests`} />
      </Stagger>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Monthly published vs delivered" description="Kilograms"><MonthlyChart data={p.monthly} /></Card>
        <Card title="Category-wise distribution" description="Number of donations"><SimpleBars horizontal height={260} data={p.categories.map((c) => ({ name: c.category, value: c.count }))} /></Card>
      </div>
      <div className="mt-6">
        <h2 className="mb-3 font-semibold">Geographic distribution of verified organizations</h2>
        <Table head={['Area', 'Donors', 'Recipients', 'Total']}>
          {p.geography.map((g) => (
            <tr key={g.area}><td className="px-4 py-2.5 font-medium">{g.area}</td><td className="px-4 py-2.5">{g.donors}</td><td className="px-4 py-2.5">{g.recipients}</td><td className="px-4 py-2.5">{g.donors + g.recipients}</td></tr>
          ))}
        </Table>
      </div>
      <div className="mt-6"><MetricDefinitions /></div>
    </>
  );
}
