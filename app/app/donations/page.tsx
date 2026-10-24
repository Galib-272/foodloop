import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/app/ui';
import { FilterBar } from '@/components/app/filter-bar';
import { DonationTable } from '@/components/donations/donation-table';
import { requireUser } from '@/lib/auth';
import { listDonations } from '@/lib/donation-queries';
import { DONATION_STATUS_LABEL, FOOD_CATEGORIES } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My Donations — FoodSphere AI' };

const ACTIVE = ['available', 'requested', 'accepted', 'scheduled', 'collected'];

export default function MyDonations({ searchParams }: { searchParams: { q?: string; status?: string; category?: string } }) {
  const user = requireUser(['donor']);
  const status = searchParams.status ? [searchParams.status] : ACTIVE;
  const rows = listDonations({ donorId: user.id, status, category: searchParams.category || undefined, q: searchParams.q || undefined });
  return (
    <>
      <PageHeader title="My Donations" description="Active donations from publication to collection. Completed and closed donations are in Donation History."
        actions={<Button asChild><Link href="/app/donations/new"><Plus className="mr-2 h-4 w-4" />Create donation</Link></Button>} />
      <FilterBar q={searchParams.q} placeholder="Search by item, ID or area"
        selects={[
          { name: 'status', label: 'Status', value: searchParams.status, options: ACTIVE.map((s) => ({ value: s, label: DONATION_STATUS_LABEL[s as keyof typeof DONATION_STATUS_LABEL] })) },
          { name: 'category', label: 'Category', value: searchParams.category, options: FOOD_CATEGORIES.map((c) => ({ value: c, label: c })) },
        ]} />
      <DonationTable rows={rows} emptyTitle="No active donations" emptyAction={<Button asChild size="sm"><Link href="/app/donations/new">Create donation</Link></Button>} />
    </>
  );
}
