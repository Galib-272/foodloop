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
import { fromLocalInput, toLocalInput } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';

function useSubmit() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  async function submit(endpoint: string, body: unknown, success: string) {
    setLoading(true);
    setError(null);
    setFields({});
    const { error } = await apiFetch(endpoint, { body });
    setLoading(false);
    if (error) {
      setError(error.message);
      setFields(error.fields ?? {});
      return false;
    }
    toast({ title: success });
    router.refresh();
    return true;
  }
  return { submit, loading, error, fields };
}

export function RequestForm({ donationId, disabledReason }: { donationId: number; disabledReason?: string | null }) {
  const [notes, setNotes] = useState('');
  const s = useSubmit();
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); s.submit(`/api/donations/${donationId}/request`, { notes }, 'Request sent to the donor'); }}>
      <FormAlert message={s.error} />
      {disabledReason && <FormAlert tone="info" message={disabledReason} />}
      <Field id="req-notes" label="Message to donor (optional)" hint="For example, when you can collect.">
        <Textarea id="req-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!!disabledReason} />
      </Field>
      <Button type="submit" className="w-full" disabled={s.loading || !!disabledReason}>
        {s.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Request Donation
      </Button>
    </form>
  );
}

export function ScheduleForm({ donationId, safeUntil, current, canAskVolunteer = true }: { donationId: number; safeUntil: string; current?: string | null; canAskVolunteer?: boolean }) {
  const def = current ?? new Date(Math.min(Date.now() + 2 * 3600_000, Date.parse(safeUntil) - 30 * 60_000)).toISOString();
  const [time, setTime] = useState(toLocalInput(def));
  const [vol, setVol] = useState(false);
  const s = useSubmit();
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); s.submit(`/api/donations/${donationId}/schedule`, { pickup_time: fromLocalInput(time), needs_volunteer: vol }, 'Collection scheduled'); }}>
      <FormAlert message={s.error && !s.fields.pickup_time ? s.error : null} />
      <Field id="pickup" label="Pickup time (Dhaka time)" error={s.fields.pickup_time} required hint={`Must be before ${toLocalInput(safeUntil).replace('T', ' ')} (Dhaka time)`}>
        <Input id="pickup" type="datetime-local" value={time} max={toLocalInput(safeUntil)} onChange={(e) => setTime(e.target.value)} />
      </Field>
      {canAskVolunteer && (
        <label className="flex items-start gap-2.5 text-sm">
          <Checkbox checked={vol} onCheckedChange={(v) => setVol(v === true)} className="mt-0.5" />
          <span>Request a volunteer to collect and deliver<span className="block text-xs text-muted-foreground">Available volunteers will be notified.</span></span>
        </label>
      )}
      <Button type="submit" className="w-full" disabled={s.loading}>
        {s.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{current ? 'Update pickup time' : 'Schedule Collection'}
      </Button>
    </form>
  );
}

export function ConfirmReceiptForm({ donationId, max, unit, reported }: { donationId: number; max: number; unit: string; reported?: number | null }) {
  const [q, setQ] = useState(String(reported ?? max));
  const [ok, setOk] = useState(true);
  const [disc, setDisc] = useState('');
  const [notes, setNotes] = useState('');
  const [time, setTime] = useState(toLocalInput(new Date()));
  const s = useSubmit();
  return (
    <form className="space-y-3" onSubmit={(e) => {
      e.preventDefault();
      s.submit(`/api/donations/${donationId}/confirm-delivery`, { quantity_received: Number(q), delivery_time: fromLocalInput(time), as_expected: ok, discrepancy: disc, notes }, 'Receipt confirmed — thank you!');
    }}>
      <FormAlert message={s.error && Object.keys(s.fields).length === 0 ? s.error : null} />
      <div className="grid grid-cols-2 gap-3">
        <Field id="q-recv" label={`Quantity received (${unit})`} error={s.fields.quantity_received} required>
          <Input id="q-recv" type="number" min={0} max={max} step="0.1" value={q} onChange={(e) => setQ(e.target.value)} />
        </Field>
        <Field id="t-recv" label="Delivery time" required>
          <Input id="t-recv" type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Was the food received as expected?</legend>
        <select aria-label="Received as expected" className={selectClass} value={ok ? 'yes' : 'no'} onChange={(e) => setOk(e.target.value === 'yes')}>
          <option value="yes">Yes, as described</option>
          <option value="no">No, there was a discrepancy</option>
        </select>
      </fieldset>
      {!ok && (
        <Field id="disc" label="Describe the discrepancy" error={s.fields.discrepancy} required>
          <Textarea id="disc" rows={2} value={disc} onChange={(e) => setDisc(e.target.value)} />
        </Field>
      )}
      <Field id="r-notes" label="Notes (optional)">
        <Textarea id="r-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <Button type="submit" className="w-full" disabled={s.loading}>
        {s.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm Receipt
      </Button>
    </form>
  );
}

export function ReportIssue({ donationId }: { donationId: number }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const s = useSubmit();
  if (!open) return <button onClick={() => setOpen(true)} className="text-sm font-medium text-muted-foreground underline-offset-2 hover:text-destructive hover:underline">Report an issue with this donation</button>;
  return (
    <form className="space-y-3 rounded-lg border p-4" onSubmit={async (e) => { e.preventDefault(); if (await s.submit(`/api/donations/${donationId}/report`, { reason, details }, 'Report sent to administrators')) setOpen(false); }}>
      <FormAlert message={s.error} />
      <Field id="rep-reason" label="Reason" required error={s.fields.reason}>
        <select id="rep-reason" className={selectClass} value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="">Select…</option>
          {['Inaccurate food information', 'Incomplete allergen information', 'Food safety concern', 'Donor or recipient did not show up', 'Inappropriate content', 'Other'].map((r) => <option key={r}>{r}</option>)}
        </select>
      </Field>
      <Field id="rep-details" label="Details">
        <Textarea id="rep-details" rows={3} value={details} onChange={(e) => setDetails(e.target.value)} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="destructive" disabled={s.loading}>Send report</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}
