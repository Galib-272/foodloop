'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FormAlert } from '@/components/forms/field';
import { apiFetch } from '@/lib/client';
import { useToast } from '@/hooks/use-toast';

export function AccountForm({ fullName, phone }: { fullName: string; phone: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [v, setV] = useState({ full_name: fullName, phone, current_password: '', new_password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await apiFetch('/api/account', { method: 'PATCH', body: v });
    setLoading(false);
    if (error) { setErrors(error.fields ?? {}); setErr(error.message); return; }
    setErrors({}); setErr(null);
    setV((s) => ({ ...s, current_password: '', new_password: '' }));
    toast({ title: 'Account updated' });
    router.refresh();
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormAlert message={err} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="acc-name" label="Full name" required error={errors.full_name}><Input id="acc-name" value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} /></Field>
        <Field id="acc-phone" label="Phone" error={errors.phone}><Input id="acc-phone" type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
        <Field id="acc-cur" label="Current password" error={errors.current_password} hint="Only needed to change your password."><Input id="acc-cur" type="password" autoComplete="current-password" value={v.current_password} onChange={(e) => setV({ ...v, current_password: e.target.value })} /></Field>
        <Field id="acc-new" label="New password" error={errors.new_password}><Input id="acc-new" type="password" autoComplete="new-password" value={v.new_password} onChange={(e) => setV({ ...v, new_password: e.target.value })} /></Field>
      </div>
      <Button type="submit" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save account</Button>
    </form>
  );
}
