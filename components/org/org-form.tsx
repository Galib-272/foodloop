'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FormAlert, selectClass } from '@/components/forms/field';
import { apiFetch } from '@/lib/client';
import { AREAS } from '@/lib/areas';
import {
  BUSINESS_TYPES,
  FOOD_CATEGORIES,
  ORG_TYPES,
  STORAGE,
  STORAGE_LABEL,
} from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';

export type OrgFormValues = {
  organization_name: string;
  organization_type: string;
  address: string;
  area: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  contact_person: string;
  operating_hours_open: string;
  operating_hours_close: string;
  verification_details: string;
  accepted_categories: string[];
  storage_capabilities: string[];
  receiving_capacity: number | string;
  required_quantity: number | string;
};

export const emptyOrg: OrgFormValues = {
  organization_name: '',
  organization_type: '',
  address: '',
  area: '',
  latitude: null,
  longitude: null,
  phone: '',
  contact_person: '',
  operating_hours_open: '09:00',
  operating_hours_close: '21:00',
  verification_details: '',
  accepted_categories: [],
  storage_capabilities: ['ambient'],
  receiving_capacity: '',
  required_quantity: '',
};

export function OrgForm({
  kind,
  initial,
  mode,
  redirectTo,
}: {
  kind: 'donor' | 'recipient';
  initial: OrgFormValues;
  mode: 'create' | 'update';
  redirectTo?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [v, setV] = useState<OrgFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const set = <K extends keyof OrgFormValues>(k: K, val: OrgFormValues[K]) => setV((s) => ({ ...s, [k]: val }));
  const toggle = (k: 'accepted_categories' | 'storage_capabilities', item: string) =>
    setV((s) => ({ ...s, [k]: s[k].includes(item) ? s[k].filter((x) => x !== item) : [...s[k], item] }));

  function pickArea(name: string) {
    const a = AREAS.find((x) => x.name === name);
    setV((s) => ({ ...s, area: name, latitude: a ? a.lat : s.latitude, longitude: a ? a.lng : s.longitude }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setFormError(null);
    const { error } = await apiFetch('/api/organizations/me', {
      method: mode === 'create' ? 'POST' : 'PATCH',
      body: v,
    });
    setLoading(false);
    if (error) {
      setErrors(error.fields ?? {});
      setFormError(error.message);
      return;
    }
    toast({ title: mode === 'create' ? 'Profile created' : 'Profile saved' });
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  const text = (k: keyof OrgFormValues, label: string, opts: { required?: boolean; type?: string; hint?: string; auto?: string } = {}) => (
    <Field id={k} label={label} error={errors[k]} required={opts.required ?? true} hint={opts.hint}>
      <Input
        id={k}
        type={opts.type ?? 'text'}
        autoComplete={opts.auto}
        value={(v[k] as string | number | null) ?? ''}
        onChange={(e) => set(k, e.target.value as never)}
        aria-invalid={!!errors[k]}
      />
    </Field>
  );

  const types = kind === 'donor' ? BUSINESS_TYPES : ORG_TYPES;

  return (
    <form onSubmit={submit} className="space-y-8" noValidate>
      <FormAlert message={formError} />

      <section className="space-y-5">
        <h2 className="text-lg font-semibold">{kind === 'donor' ? 'Business details' : 'Organization details'}</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {text('organization_name', kind === 'donor' ? 'Business Name' : 'Organization Name')}
          <Field id="organization_type" label={kind === 'donor' ? 'Business Type' : 'Organization Type'} error={errors.organization_type} required>
            <select id="organization_type" className={selectClass} value={v.organization_type} onChange={(e) => set('organization_type', e.target.value)}>
              <option value="">Select…</option>
              {types.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
          {text('contact_person', 'Contact Person', { auto: 'name' })}
          {text('phone', 'Contact Phone', { required: false, type: 'tel', auto: 'tel' })}
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="text-lg font-semibold">Location</h2>
        {text('address', 'Address', { auto: 'street-address' })}
        <div className="grid gap-5 sm:grid-cols-3">
          <Field id="area" label="Area or City" error={errors.area} required hint="Sets approximate coordinates for distance matching.">
            <select id="area" className={selectClass} value={AREAS.some((a) => a.name === v.area) ? v.area : v.area ? '__other' : ''}
              onChange={(e) => (e.target.value === '__other' ? set('area', 'Other') : pickArea(e.target.value))}>
              <option value="">Select…</option>
              {AREAS.map((a) => (
                <option key={a.name} value={a.name}>{a.name}</option>
              ))}
              <option value="__other">Other</option>
            </select>
          </Field>
          <Field id="latitude" label="Latitude" error={errors.latitude} hint="Optional">
            <Input id="latitude" inputMode="decimal" value={v.latitude ?? ''} onChange={(e) => set('latitude', e.target.value === '' ? null : (e.target.value as unknown as number))} />
          </Field>
          <Field id="longitude" label="Longitude" error={errors.longitude} hint="Optional">
            <Input id="longitude" inputMode="decimal" value={v.longitude ?? ''} onChange={(e) => set('longitude', e.target.value === '' ? null : (e.target.value as unknown as number))} />
          </Field>
        </div>
        {v.area === 'Other' && text('area', 'Area name')}
        <div className="grid gap-5 sm:grid-cols-2">
          {text('operating_hours_open', kind === 'donor' ? 'Opens at' : 'Receiving from', { type: 'time' })}
          {text('operating_hours_close', kind === 'donor' ? 'Closes at' : 'Receiving until', { type: 'time' })}
        </div>
      </section>

      {kind === 'recipient' && (
        <section className="space-y-5">
          <h2 className="text-lg font-semibold">Food requirements & capacity</h2>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Accepted Food Categories<span className="ml-0.5 text-destructive" aria-hidden="true">*</span></legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {FOOD_CATEGORIES.map((c) => (
                <label key={c} className="flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm hover:bg-muted">
                  <Checkbox checked={v.accepted_categories.includes(c)} onCheckedChange={() => toggle('accepted_categories', c)} />
                  {c}
                </label>
              ))}
            </div>
            {errors.accepted_categories && <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">{errors.accepted_categories}</p>}
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Storage Capabilities<span className="ml-0.5 text-destructive" aria-hidden="true">*</span></legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {STORAGE.map((s) => (
                <label key={s} className="flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm hover:bg-muted">
                  <Checkbox checked={v.storage_capabilities.includes(s)} onCheckedChange={() => toggle('storage_capabilities', s)} />
                  {STORAGE_LABEL[s]}
                </label>
              ))}
            </div>
            {errors.storage_capabilities && <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">{errors.storage_capabilities}</p>}
          </fieldset>
          <div className="grid gap-5 sm:grid-cols-2">
            {text('receiving_capacity', 'Receiving Capacity per Day (kg-equivalent)', { type: 'number' })}
            {text('required_quantity', 'Typical Daily Food Requirement (kg-equivalent)', { type: 'number', required: false })}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Verification</h2>
        <Field id="verification_details" label={kind === 'donor' ? 'Business Verification Details' : 'Verification Information'} error={errors.verification_details}
          hint={kind === 'donor' ? 'For example, trade licence number.' : 'For example, NGO Affairs Bureau or social welfare registration number.'}>
          <Textarea id="verification_details" rows={3} value={v.verification_details} onChange={(e) => set('verification_details', e.target.value)} />
        </Field>
        <p className="text-xs text-muted-foreground">
          An administrator reviews this information.{' '}
          {kind === 'recipient'
            ? 'You can browse donations while pending, but only verified organizations can request them.'
            : 'You can set up inventory and forecasts while pending; publishing donations requires verification.'}
        </p>
      </section>

      <Button type="submit" size="lg" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {mode === 'create' ? 'Complete Setup' : 'Save Changes'}
      </Button>
    </form>
  );
}
