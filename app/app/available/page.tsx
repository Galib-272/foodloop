import Link from 'next/link';
import { LayoutGrid, Map } from 'lucide-react';
import { Notice, PageHeader, EmptyState } from '@/components/app/ui';
import { FilterBar } from '@/components/app/filter-bar';
import { DonationCard } from '@/components/app/donation-card';
import { AreaMap } from '@/components/app/area-map';
import { ActionButton } from '@/components/app/action-button';
import { requireUser } from '@/lib/auth';
import { listDonations } from '@/lib/donation-queries';
import { getOrgByUser } from '@/lib/orgs';
import { evaluate } from '@/lib/matching';
import { haversineKm } from '@/lib/areas';
import { FOOD_CATEGORIES, STORAGE, STORAGE_LABEL } from '@/lib/constants';
import { redact, viewerFor } from '@/lib/donations';
import { cn } from '@/lib/utils';
import { Stagger } from '@/components/motion';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Available Donations — FoodSphere AI' };

type SP = { q?: string; category?: string; storage?: string; distance?: string; deadline?: string; verified?: string; minqty?: string; view?: string; eligible?: string };

export default function Available({ searchParams: sp }: { searchParams: SP }) {
  const user = requireUser(['recipient', 'admin']);
  const org = getOrgByUser(user.id);
  // Default to the organization's accepted categories ("donations that meet requirements").
  const onlyEligible = sp.eligible !== '0' && !!org;
  let list = listDonations({ status: ['available', 'requested'], activeOnly: true, category: sp.category || undefined, storage: sp.storage || undefined, q: sp.q || undefined, verifiedDonorOnly: sp.verified === '1' });
  const rows = list.map((d) => {
    const dist = org?.latitude != null && d.latitude != null ? Math.round(haversineKm(org.latitude, org.longitude!, d.latitude, d.longitude!) * 10) / 10 : null;
    const ev = org ? evaluate(d, org) : null;
    return { d, dist, eligible: ev?.ok ?? false, reason: ev && !ev.ok ? ev.reason : null };
  }).filter((r) => {
    if (onlyEligible && !r.eligible) return false;
    if (sp.distance && r.dist != null && r.dist > Number(sp.distance)) return false;
    if (sp.deadline && Date.parse(r.d.safe_until) - Date.now() > Number(sp.deadline) * 3600_000) return false;
    if (sp.minqty && r.d.quantity_available < Number(sp.minqty)) return false;
    return true;
  });
  list = rows.map((r) => r.d);
  const view = sp.view === 'map' ? 'map' : 'list';
  const qs = (v: string) => '?' + new URLSearchParams({ ...(sp as Record<string, string>), view: v }).toString();

  return (
    <>
      <PageHeader title="Available Donations" description="Open donations that meet your organization’s requirements. Exact addresses are shared after acceptance."
        actions={
          <div className="inline-flex rounded-lg border bg-card p-1" role="group" aria-label="View">
            <Link href={qs('list')} aria-current={view === 'list'} className={cn('inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium', view === 'list' && 'bg-primary text-primary-foreground')}><LayoutGrid className="h-4 w-4" />List</Link>
            <Link href={qs('map')} aria-current={view === 'map'} className={cn('inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium', view === 'map' && 'bg-primary text-primary-foreground')}><Map className="h-4 w-4" />Map</Link>
          </div>
        } />
      {org && org.verification_status !== 'verified' && <div className="mb-5"><Notice tone="warning">Your organization is not verified yet, so you can browse but not request donations.</Notice></div>}
      <FilterBar q={sp.q} placeholder="Search food or area"
        selects={[
          { name: 'category', label: 'Category', value: sp.category, options: FOOD_CATEGORIES.map((c) => ({ value: c, label: c })) },
          { name: 'storage', label: 'Storage', value: sp.storage, options: STORAGE.map((s) => ({ value: s, label: STORAGE_LABEL[s].split(' (')[0] })) },
          { name: 'distance', label: 'Distance', value: sp.distance, options: [3, 5, 10, 20].map((k) => ({ value: String(k), label: `Within ${k} km` })) },
          { name: 'deadline', label: 'Deadline', value: sp.deadline, options: [4, 12, 24, 48].map((h) => ({ value: String(h), label: `Within ${h} h` })) },
          { name: 'minqty', label: 'Quantity', value: sp.minqty, options: [5, 10, 25, 50].map((q) => ({ value: String(q), label: `At least ${q}` })) },
          { name: 'verified', label: 'Donor', value: sp.verified, options: [{ value: '1', label: 'Verified donors only' }] },
          { name: 'eligible', label: 'Matching', value: sp.eligible, options: [{ value: '0', label: 'Show all (incl. ineligible)' }] },
        ]}>
        <input type="hidden" name="view" value={view} />
      </FilterBar>
      {list.length === 0 ? <EmptyState title="No donations match these filters">Try widening the distance or deadline filters.</EmptyState>
        : view === 'map' ? (
          <AreaMap home={org?.latitude != null ? { lat: org.latitude, lng: org.longitude!, label: 'You' } : null}
            points={list.filter((d) => d.latitude != null).map((d) => ({ id: d.id, lat: d.latitude!, lng: d.longitude!, label: `${d.item_name} · ${d.quantity_available} ${d.unit} · ${d.area}`, urgent: Date.parse(d.safe_until) - Date.now() < 8 * 3600_000 }))} />
        ) : (
          <Stagger className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3" itemClassName="h-full" hover>
            {rows.map(({ d, dist, reason }) => (
              <DonationCard key={d.id} d={redact(d, viewerFor(user, d))} distance={dist}
                explanation={reason ? `Not eligible for your organization: ${reason}.` : undefined}
                footer={<>
                  <Link href={`/app/donations/${d.id}`} className="text-sm font-semibold text-secondary hover:underline">View Details</Link>
                  {user.role === 'recipient' && <span className="ml-auto"><ActionButton endpoint={`/api/donations/${d.id}/decline-recommendation`} label="Not for us" variant="ghost" success="Hidden from your recommendations" /></span>}
                </>} />
            ))}
          </Stagger>
        )}
    </>
  );
}
