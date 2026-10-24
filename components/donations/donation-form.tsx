'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FormAlert, selectClass } from '@/components/forms/field';
import { apiFetch } from '@/lib/client';
import { FOOD_CATEGORIES, STORAGE, STORAGE_LABEL, UNITS } from '@/lib/constants';
import { SAFETY_CHECKS } from '@/lib/validation';
import { fromLocalInput, toLocalInput } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';

export type DonationFormValues = {
  item_name: string; food_category: string; quantity_available: string; unit: string; prepared_at: string; available_from: string; safe_until: string;
  storage_requirement: string; pickup_address: string; area: string; latitude: string; longitude: string; description: string; packaging: string;
  allergens: string; handling_instructions: string; contact_method: string; notes: string; forecast_id: number | null; inventory_id: number | null;
};

export function DonationForm({ initial, editId, forecastNote }: { initial: DonationFormValues; editId?: number; forecastNote?: string | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [v, setV] = useState(initial);
  const [checks, setChecks] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const set = (k: keyof DonationFormValues, val: string) => setV((s) => ({ ...s, [k]: val }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setFormError(null);
    const body = {
      ...v,
      prepared_at: v.prepared_at ? fromLocalInput(v.prepared_at) : null,
      available_from: fromLocalInput(v.available_from),
      safe_until: fromLocalInput(v.safe_until),
      latitude: v.latitude === '' ? null : v.latitude,
      longitude: v.longitude === '' ? null : v.longitude,
      safety_checks: checks,
    };
    const { data, error } = await apiFetch<{ id: number; matches: number }>(editId ? `/api/donations/${editId}` : '/api/donations', { method: editId ? 'PATCH' : 'POST', body });
    setLoading(false);
    if (error) {
      setErrors(error.fields ?? {});
      setFormError(error.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    toast({ title: editId ? 'Donation updated' : 'Donation published', description: editId ? undefined : `${data!.matches} eligible recipient(s) found.` });
    router.push(`/app/donations/${editId ?? data!.id}`);
    router.refresh();
  }

  const text = (k: keyof DonationFormValues, label: string, o: { required?: boolean; type?: string; hint?: string; placeholder?: string } = {}) => (
    <Field id={k} label={label} error={errors[k]} required={o.required} hint={o.hint}>
      <Input id={k} type={o.type ?? 'text'} placeholder={o.placeholder} value={String(v[k] ?? '')} onChange={(e) => set(k, e.target.value)} aria-invalid={!!errors[k]} />
    </Field>
  );

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <FormAlert message={formError} />
      {forecastNote && (
        <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{forecastNote} <strong>Please check and enter the actual quantity you have available</strong> — an AI forecast never publishes a donation on its own.</p>
        </div>
      )}

      <section className="rounded-xl border bg-card p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold">Food</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {text('item_name', 'Food Item Name', { required: true, placeholder: 'e.g. Vegetable Khichuri' })}
          <Field id="food_category" label="Food Category" error={errors.food_category} required>
            <select id="food_category" className={selectClass} value={v.food_category} onChange={(e) => set('food_category', e.target.value)}>
              <option value="">Select…</option>
              {FOOD_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-[1fr_120px] gap-3">
            {text('quantity_available', 'Available Quantity', { required: true, type: 'number' })}
            <Field id="unit" label="Unit" required>
              <select id="unit" className={selectClass} value={v.unit} onChange={(e) => set('unit', e.target.value)}>
                {UNITS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </Field>
          </div>
          <Field id="storage_requirement" label="Storage Requirement" error={errors.storage_requirement} required>
            <select id="storage_requirement" className={selectClass} value={v.storage_requirement} onChange={(e) => set('storage_requirement', e.target.value)}>
              {STORAGE.map((s) => <option key={s} value={s}>{STORAGE_LABEL[s]}</option>)}
            </select>
          </Field>
          <Field id="description" label="Food Description" className="sm:col-span-2">
            <Textarea id="description" rows={2} value={v.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
          {text('packaging', 'Packaging Information', { required: true, placeholder: 'e.g. Sealed food-grade containers' })}
          {text('allergens', 'Allergen Information', { hint: 'e.g. Gluten, Milk, Nuts. Leave blank if none.' })}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold">Timing</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {text('prepared_at', 'Preparation / Production Time', { type: 'datetime-local', hint: 'Where applicable' })}
          {text('available_from', 'Available From', { required: true, type: 'datetime-local' })}
          {text('safe_until', 'Verified Safe-Use Deadline', { required: true, type: 'datetime-local', hint: 'You are responsible for this deadline.' })}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold">Pickup</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">{text('pickup_address', 'Pickup Address', { required: true })}</div>
          {text('area', 'Area')}
          <div className="grid grid-cols-2 gap-3">
            {text('latitude', 'Latitude', { hint: 'Optional' })}
            {text('longitude', 'Longitude', { hint: 'Optional' })}
          </div>
          {text('contact_method', 'Contact Method', { required: true, placeholder: 'e.g. Call the kitchen manager' })}
          {text('handling_instructions', 'Additional Handling Instructions')}
          <Field id="notes" label="Supporting Notes" className="sm:col-span-2">
            <Textarea id="notes" rows={2} value={v.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-amber-300 bg-amber-50/60 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Food-safety confirmation</h2>
        <p className="mt-1 text-sm text-muted-foreground">FoodSphere AI does not certify food safety. Please confirm each statement.</p>
        <div className="mt-4 space-y-3">
          {SAFETY_CHECKS.map((c) => (
            <label key={c} className="flex items-start gap-3 text-sm">
              <Checkbox checked={checks.includes(c)} onCheckedChange={(on) => setChecks((s) => (on ? [...s, c] : s.filter((x) => x !== c)))} className="mt-0.5" />
              {c}
            </label>
          ))}
        </div>
        {errors.safety_checks && <p role="alert" className="mt-2 text-xs font-medium text-destructive">{errors.safety_checks}</p>}
      </section>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={loading || checks.length < SAFETY_CHECKS.length}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editId ? 'Save Changes' : 'Publish Donation'}
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}

export const defaultTimes = () => ({
  available_from: toLocalInput(new Date()),
  safe_until: toLocalInput(new Date(Date.now() + 6 * 3600_000)),
});
