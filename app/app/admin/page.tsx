import Link from 'next/link';
import { Stagger } from '@/components/motion';
import { AlertTriangle, CheckCircle2, Flag, HandHeart, ShieldQuestion, Users } from 'lucide-react';
import { Card, PageHeader, StatCard } from '@/components/app/ui';
import { MonthlyChart, SimpleBars } from '@/components/app/charts';
import { adminOverview } from '@/lib/admin';
import { formatTotals } from '@/lib/analytics';
import { DONATION_STATUS_LABEL, type DonationStatus } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin Overview — FoodSphere AI' };

export default function AdminOverview() {
  const o = adminOverview();
  const p = o.platform;
  return (
    <>
      <PageHeader title="Admin Overview" description="Platform operations, trust and data quality at a glance." />
      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6" itemClassName="h-full">
        <StatCard label="Total Users" icon={Users} value={o.totalUsers} href="/app/admin/users" />
        <StatCard label="Pending Verifications" icon={ShieldQuestion} tone={o.pendingVerifications ? 'amber' : 'default'} value={o.pendingVerifications} href="/app/admin/verifications" />
        <StatCard label="Active Donations" icon={HandHeart} value={o.activeDonations} href="/app/admin/donations" />
        <StatCard label="Completed Donations" icon={CheckCircle2} tone="green" value={o.completedDonations} hint={formatTotals(p.delivered)} />
        <StatCard label="Reported Issues" icon={Flag} tone={o.reportedIssues ? 'red' : 'default'} value={o.reportedIssues} href="/app/admin/reports" />
        <StatCard label="Failed Collections" icon={AlertTriangle} tone={o.failedCollections ? 'red' : 'default'} value={o.failedCollections} href="/app/admin/donations?status=failed" />
      </Stagger>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Donations by status">
          <SimpleBars horizontal height={280} data={(Object.keys(DONATION_STATUS_LABEL) as DonationStatus[]).map((s) => ({ name: DONATION_STATUS_LABEL[s], value: p.statuses[s] ?? 0 }))} />
        </Card>
        <Card title="Monthly delivered quantities" description="Kilograms confirmed delivered">
          <MonthlyChart data={p.monthly.map((m) => ({ month: m.month, delivered: m.delivered }))} />
        </Card>
        <Card title="User registration trend" description="New accounts per month">
          <SimpleBars height={240} data={p.registrations.map((r) => ({ name: r.month, value: r.users }))} color="#2f7fc4" />
        </Card>
        <Card title="Donation categories" description="All published donations" action={<Link href="/app/admin/analytics" className="text-sm font-medium text-secondary hover:underline">More analytics</Link>}>
          <SimpleBars horizontal height={240} data={p.categories.map((c) => ({ name: c.category, value: c.count }))} />
        </Card>
      </div>
    </>
  );
}
