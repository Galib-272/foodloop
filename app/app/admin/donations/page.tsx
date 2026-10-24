import { PageHeader } from '@/components/app/ui';
import { FilterBar } from '@/components/app/filter-bar';
import { DonationTable } from '@/components/donations/donation-table';
import { listDonations } from '@/lib/donation-queries';
import { DONATION_STATUSES, DONATION_STATUS_LABEL, FOOD_CATEGORIES } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Donation Management — FoodSphere AI' };

export default function AdminDonations({ searchParams }: { searchParams: { q?: string; status?: string; category?: string } }) {
  const rows = listDonations({ status: searchParams.status ? [searchParams.status] : undefined, category: searchParams.category || undefined, q: searchParams.q || undefined });
  return (
    <>
      <PageHeader title="Donation Management" description="Search and review all donations. Open a donation to resolve disputes or record an audited correction." />
      <FilterBar q={searchParams.q} placeholder="Search item, ID or area"
        selects={[
          { name: 'status', label: 'Status', value: searchParams.status, options: DONATION_STATUSES.map((s) => ({ value: s, label: DONATION_STATUS_LABEL[s] })) },
          { name: 'category', label: 'Category', value: searchParams.category, options: FOOD_CATEGORIES.map((c) => ({ value: c, label: c })) },
        ]} />
      <DonationTable rows={rows} showDonor />
    </>
  );
}
