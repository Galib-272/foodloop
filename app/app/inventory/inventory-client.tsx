'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Field, FormAlert, selectClass } from '@/components/forms/field';
import { apiFetch } from '@/lib/client';
import { FOOD_CATEGORIES, STORAGE, STORAGE_LABEL, UNITS } from '@/lib/constants';
import { fromLocalInput } from '@/lib/format';
import type { InvValues } from './inventory-values';
export type { InvValues };
import { useToast } from '@/hooks/use-toast';


export function InventoryDialog({ initial, trigger }: { initial?: InvValues; trigger?: React.ReactNode }) {
  const router = useRouter();
  const { toast } = useToast();
  const blank: InvValues = { item_name: '', food_category: '', quantity: '', unit: 'kg', recorded_date: new Date().toISOString().slice(0, 10), safe_until: '', shelf_life_days: '', storage_requirement: 'ambient' };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<InvValues>(initial ?? blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const set = (k: keyof InvValues, val: string) => setV((s) => ({ ...s, [k]: val }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const body = { ...v, safe_until: v.safe_until ? fromLocalInput(v.safe_until) : null, shelf_life_days: v.shelf_life_days === '' ? null : v.shelf_life_days };
    const { error } = await apiFetch(initial?.id ? `/api/inventory/${initial.id}` : '/api/inventory', { method: initial?.id ? 'PATCH' : 'POST', body });
    setLoading(false);
    if (error) { setErrors(error.fields ?? {}); setErr(error.message); return; }
    toast({ title: initial?.id ? 'Inventory updated' : 'Inventory added' });
    setOpen(false);
    if (!initial) setV(blank);
    router.refresh();
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button><Plus className="mr-2 h-4 w-4" />Add inventory</Button>}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial?.id ? 'Edit inventory record' : 'Add inventory'}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <FormAlert message={err} />
          <Field id="inv-name" label="Item name" required error={errors.item_name}><Input id="inv-name" value={v.item_name} onChange={(e) => set('item_name', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="inv-cat" label="Category" required error={errors.food_category}>
              <select id="inv-cat" className={selectClass} value={v.food_category} onChange={(e) => set('food_category', e.target.value)}><option value="">Select…</option>{FOOD_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            </Field>
            <Field id="inv-storage" label="Storage" required>
              <select id="inv-storage" className={selectClass} value={v.storage_requirement} onChange={(e) => set('storage_requirement', e.target.value)}>{STORAGE.map((s) => <option key={s} value={s}>{STORAGE_LABEL[s].split(' (')[0]}</option>)}</select>
            </Field>
            <Field id="inv-q" label="Quantity" required error={errors.quantity}><Input id="inv-q" type="number" min={0} step="0.1" value={v.quantity} onChange={(e) => set('quantity', e.target.value)} /></Field>
            <Field id="inv-unit" label="Unit" required>
              <select id="inv-unit" className={selectClass} value={v.unit} onChange={(e) => set('unit', e.target.value)}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
            </Field>
            <Field id="inv-date" label="Stock date" required error={errors.recorded_date}><Input id="inv-date" type="date" value={v.recorded_date} onChange={(e) => set('recorded_date', e.target.value)} /></Field>
            <Field id="inv-shelf" label="Shelf life (days)" error={errors.shelf_life_days}><Input id="inv-shelf" type="number" min={0} value={v.shelf_life_days} onChange={(e) => set('shelf_life_days', e.target.value)} /></Field>
          </div>
          <Field id="inv-safe" label="Safe-use deadline" hint="Optional. If blank, calculated from stock date + shelf life.">
            <Input id="inv-safe" type="datetime-local" value={v.safe_until} onChange={(e) => set('safe_until', e.target.value)} />
          </Field>
          <Button type="submit" className="w-full" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

