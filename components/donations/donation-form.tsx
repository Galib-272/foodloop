'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Camera, Loader2, Sparkles, Wand2 } from 'lucide-react';
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
import { readPhotoText } from '@/lib/ocr';

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
  const [quick, setQuick] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractInfo, setExtractInfo] = useState<{ source: string; filled: string[]; notes: string[] } | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);

  // OCR runs in the browser (Tesseract): the photo never leaves the device, only the text it contains is sent.
  async function fillFromPhoto(file: File | undefined) {
    if (!file) return;
    setExtractError(null);
    setExtractInfo(null);
    if (!file.type.startsWith('image/')) { setExtractError('Please choose a photo (JPG or PNG).'); return; }
    if (file.size > 15 * 1024 * 1024) { setExtractError('That photo is too large (max 15 MB).'); return; }
    setOcrProgress(0);
    try {
      const { text, confidence } = await readPhotoText(file, setOcrProgress);
      if (text.length < 5) { setExtractError('No readable text found in the photo. Try a sharper, well-lit photo, or type the details.'); return; }
      setQuick(text);
      await fillFromText(text, `Text read from your photo with OCR (Tesseract, ${confidence}% confidence). Check every field.`);
    } catch {
      setExtractError('Could not read the photo. Please try again or type the details.');
    } finally {
      setOcrProgress(null);
      if (photoInput.current) photoInput.current.value = '';
    }
  }

  async function fillFromText(input = quick, note?: string) {
    setExtracting(true);
    setExtractError(null);
    const { data, error } = await apiFetch<{ fields: Record<string, string | number>; source: string; missing: string[]; notes: string[] }>(
      '/api/donations/extract', { body: { text: input } });
    setExtracting(false);
    if (error || !data) { setExtractError(error?.fields?.text ?? error?.message ?? 'Could not read that text.'); return; }
    const f = data.fields;
    const next: Partial<DonationFormValues> = {};
    for (const k of ['item_name', 'food_category', 'unit', 'storage_requirement', 'allergens', 'packaging'] as const) if (f[k]) next[k] = String(f[k]);
    if (f.quantity_available) next.quantity_available = String(f.quantity_available);
    if (f.available_from) next.available_from = toLocalInput(String(f.available_from));
    if (f.safe_until) next.safe_until = toLocalInput(String(f.safe_until));
    if (f.description && !v.description) next.description = String(f.description);
    setV((s) => ({ ...s, ...next }));
    const LABEL: Record<string, string> = { item_name: 'name', food_category: 'category', quantity_available: 'quantity', unit: 'unit',
      storage_requirement: 'storage', available_from: 'available from', safe_until: 'safe-use deadline', allergens: 'allergens', packaging: 'packaging', description: 'description' };
    setExtractInfo({ source: data.source, filled: Object.keys(next).map((k) => LABEL[k] ?? k), notes: note ? [note, ...data.notes] : data.notes });
  }

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

      {!editId && (
        <section className="rounded-xl border border-secondary/40 bg-accent/30 p-5 sm:p-6" aria-labelledby="quick-fill">
          <h2 id="quick-fill" className="flex items-center gap-2 text-lg font-semibold"><Wand2 className="h-5 w-5 text-secondary" aria-hidden /> Quick fill with AI</h2>
          <p className="mt-1 text-sm text-muted-foreground">Describe the food in one sentence, or read a photo of your note, label or packing slip, and AI fills in the form below. You check and correct every field before publishing.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <label htmlFor="quick-text" className="sr-only">Describe the food</label>
            <Textarea id="quick-text" rows={2} maxLength={500} value={quick} onChange={(e) => setQuick(e.target.value)}
              placeholder="e.g. 20 boxes of chicken biryani, ready at 8pm, good until 11pm, contains nuts" />
            <div className="flex gap-2 sm:flex-col sm:self-end">
              <Button type="button" variant="secondary" className="flex-1 gap-2" onClick={() => fillFromText()} disabled={extracting || ocrProgress !== null || quick.trim().length < 5}>
                {extracting && ocrProgress === null ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Wand2 className="h-4 w-4" aria-hidden />} Fill the form
              </Button>
              <Button type="button" variant="outline" className="flex-1 gap-2" onClick={() => photoInput.current?.click()} disabled={extracting || ocrProgress !== null}>
                {ocrProgress !== null ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Camera className="h-4 w-4" aria-hidden />}
                {ocrProgress !== null ? `Reading ${ocrProgress}%` : 'Read a photo'}
              </Button>
              <input ref={photoInput} type="file" accept="image/*" className="sr-only" aria-label="Photo of a food note, label or packing slip"
                onChange={(e) => fillFromPhoto(e.target.files?.[0])} />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Photos are read on your device with OCR and never uploaded. Phone numbers and emails are removed before AI reads the text.</p>
          {extractError && <p className="mt-2 text-sm text-destructive">{extractError}</p>}
          {extractInfo && (
            <div className="mt-3 rounded-lg border bg-card p-3 text-sm" role="status">
              <p><strong>Filled:</strong> {extractInfo.filled.length ? extractInfo.filled.join(', ') : 'nothing recognised'}{' '}
                <span className="text-muted-foreground">({extractInfo.source.startsWith('ollama:') ? `local AI model ${extractInfo.source.slice(7)}, structured JSON` : 'rule-based reader'})</span></p>
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">{extractInfo.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
          )}
        </section>
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
        <p className="mt-1 text-sm text-muted-foreground">FoodLoop does not certify food safety. Please confirm each statement.</p>
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
