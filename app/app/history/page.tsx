import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/app/ui';
import { FilterBar } from '@/components/app/filter-bar';
import { DonationTable } from '@/components/donations/donation-table';
import { requireUser } from '@/lib/auth';
import { listDonations } from '@/lib/donation-queries';
import { DONATION_STATUS_LABEL, FOOD_CATEGORIES, TERMINAL_STATUSES } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Donation History — FoodSphere AI' };

export default function History({ searchParams }: { searchParams: { q?: string; status?: string; category?: string } }) {
  const user = requireUser(['donor']);
  const rows = listDonations({ donorId: user.id, status: searchParams.status ? [searchParams.status] : TERMINAL_STATUSES, category: searchParams.category || undefined, q: searchParams.q || undefined });
  return (
    <>
      <PageHeader title="Donation History" description="Delivered, cancelled, expired, rejected and failed donations."
        actions={<Button asChild variant="outline"><a href="/api/analytics/export"><Download className="mr-2 h-4 w-4" />Export delivered (CSV)</a></Button>} />
      <FilterBar q={searchParams.q} placeholder="Search by item, ID or area"
        selects={[
          { name: 'status', label: 'Outcome', value: searchParams.status, options: TERMINAL_STATUSES.map((s) => ({ value: s, label: DONATION_STATUS_LABEL[s] })) },
          { name: 'category', label: 'Category', value: searchParams.category, options: FOOD_CATEGORIES.map((c) => ({ value: c, label: c })) },
        ]} />
      <DonationTable rows={rows} emptyTitle="No past donations yet" />
    </>
  );
}
