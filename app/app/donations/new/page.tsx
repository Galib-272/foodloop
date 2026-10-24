import { PageHeader, Notice } from '@/components/app/ui';
import { DonationForm, type DonationFormValues } from '@/components/donations/donation-form';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getDonation } from '@/lib/donations';
import { getOrgByUser } from '@/lib/orgs';
import { toLocalInput } from '@/lib/format';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Create Donation — FoodSphere AI' };

export default function NewDonation({ searchParams }: { searchParams: { forecast?: string; inventory?: string; edit?: string } }) {
  const user = requireUser(['donor']);
  const org = getOrgByUser(user.id)!;
  const now = new Date();
  let v: DonationFormValues = {
    item_name: '', food_category: '', quantity_available: '', unit: 'kg', prepared_at: '', available_from: toLocalInput(now),
    safe_until: toLocalInput(new Date(now.getTime() + 6 * 3600_000)), storage_requirement: 'ambient', pickup_address: org.address, area: org.area,
    latitude: org.latitude != null ? String(org.latitude) : '', longitude: org.longitude != null ? String(org.longitude) : '', description: '',
    packaging: '', allergens: '', handling_instructions: '', contact_method: `Call ${org.contact_person ?? user.full_name}${org.phone ? ' at ' + org.phone : ''}`,
    notes: '', forecast_id: null, inventory_id: null,
  };
  let note: string | null = null;

  if (searchParams.edit) {
    const d = getDonation(Number(searchParams.edit));
    if (!d || d.donor_id !== user.id) redirect('/app/donations');
    if (d.status !== 'available') redirect(`/app/donations/${d.id}`);
    v = {
      ...v, item_name: d.item_name, food_category: d.food_category, quantity_available: String(d.quantity_available), unit: d.unit,
      prepared_at: d.prepared_at ? toLocalInput(d.prepared_at) : '', available_from: toLocalInput(d.available_from), safe_until: toLocalInput(d.safe_until),
      storage_requirement: d.storage_requirement, pickup_address: d.pickup_address, area: d.area ?? '', latitude: d.latitude != null ? String(d.latitude) : '',
      longitude: d.longitude != null ? String(d.longitude) : '', description: d.description ?? '', packaging: d.packaging ?? '', allergens: d.allergens ?? '',
      handling_instructions: d.handling_instructions ?? '', contact_method: d.contact_method ?? '', notes: d.notes ?? '',
    };
  } else if (searchParams.forecast) {
    const f = getDb().prepare('SELECT * FROM forecast_records WHERE id = ? AND donor_id = ?').get(Number(searchParams.forecast), user.id);
    if (f && f.forecast_quantity != null) {
      const hist = getDb().prepare('SELECT storage_temperature FROM sales_history WHERE donor_id = ? AND food_category = ? AND storage_temperature IS NOT NULL ORDER BY date DESC LIMIT 1').get(user.id, f.food_category);
      const t = hist?.storage_temperature != null ? Number(hist.storage_temperature) : null;
      const storage = t == null ? (['Dairy', 'Meat'].includes(String(f.food_category)) ? 'refrigerated' : 'ambient') : t <= -5 ? 'frozen' : t <= 8 ? 'refrigerated' : 'ambient';
      v = { ...v, food_category: String(f.food_category), quantity_available: String(f.forecast_quantity), unit: String(f.unit),
        item_name: `Surplus ${String(f.food_category).toLowerCase()}`, description: 'Estimated leftover from the AI forecast — confirm the real quantity.',
        storage_requirement: storage, forecast_id: Number(f.id) };
      note = `Prefilled from forecast #${f.id} (${f.model_version}): estimated ${f.lower_bound}–${f.upper_bound} ${f.unit} of ${String(f.food_category).toLowerCase()} for ${f.forecast_date}.`;
    }
  } else if (searchParams.inventory) {
    const i = getDb().prepare('SELECT * FROM inventory_records WHERE id = ? AND donor_id = ?').get(Number(searchParams.inventory), user.id);
    if (i) {
      v = { ...v, item_name: String(i.item_name), food_category: String(i.food_category), quantity_available: String(i.quantity), unit: String(i.unit),
        storage_requirement: String(i.storage_requirement), safe_until: i.safe_until ? toLocalInput(String(i.safe_until)) : v.safe_until, inventory_id: Number(i.id) };
      note = null;
    }
  }

  const verified = org.verification_status === 'verified';
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={searchParams.edit ? 'Edit Donation' : 'Create Donation'} description="Publish surplus food so verified organizations can request it before the safe-use deadline." />
      {!verified && !searchParams.edit && <div className="mb-6"><Notice tone="warning" title="Verification required">Your business must be verified before you can publish donations. You can still fill in the form.</Notice></div>}
      <DonationForm initial={v} editId={searchParams.edit ? Number(searchParams.edit) : undefined} forecastNote={note} />
    </div>
  );
}
