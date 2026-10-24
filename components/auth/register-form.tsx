'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { HeartHandshake, Loader2, Store, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FormAlert } from '@/components/forms/field';
import { apiFetch } from '@/lib/client';
import { cn } from '@/lib/utils';

const ROLES = [
  { value: 'donor', label: 'Donor', desc: 'Restaurant, shop, market or event', icon: Store },
  { value: 'recipient', label: 'Recipient Organization', desc: 'NGO, kitchen, shelter or food bank', icon: HeartHandshake },
  { value: 'volunteer', label: 'Volunteer', desc: 'Help collect and deliver food', icon: Truck },
] as const;

export function RegisterForm({ initialRole }: { initialRole?: string }) {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    role: ROLES.some((r) => r.value === initialRole) ? initialRole! : '',
    phone: '',
    accept_terms: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setFormError(null);
    const { data, error } = await apiFetch<{ redirect: string }>('/api/auth/register', { body: form });
    setLoading(false);
    if (error) {
      setErrors(error.fields ?? {});
      setFormError(error.message);
      return;
    }
    router.push(data!.redirect);
    router.refresh();
  }

  const input = (k: 'full_name' | 'email' | 'password' | 'confirm_password' | 'phone', label: string, type = 'text', auto?: string, required = true, hint?: string) => (
    <Field id={k} label={label} error={errors[k]} required={required} hint={hint}>
      <Input id={k} type={type} autoComplete={auto} value={form[k]} onChange={(e) => set(k, e.target.value)}
        aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `${k}-error` : hint ? `${k}-hint` : undefined} />
    </Field>
  );

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <FormAlert message={formError} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Account Type<span className="ml-0.5 text-destructive" aria-hidden="true">*</span></legend>
        <div className="grid gap-2" role="radiogroup" aria-label="Account type">
          {ROLES.map((r) => (
            <button key={r.value} type="button" role="radio" aria-checked={form.role === r.value} onClick={() => set('role', r.value)}
              className={cn('flex items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                form.role === r.value ? 'border-secondary bg-accent ring-1 ring-secondary' : 'hover:bg-muted')}>
              <r.icon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <span>
                <span className="block text-sm font-semibold">{r.label}</span>
                <span className="block text-xs text-muted-foreground">{r.desc}</span>
              </span>
            </button>
          ))}
        </div>
        {errors.role && <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">{errors.role}</p>}
      </fieldset>
      {input('full_name', 'Full Name', 'text', 'name')}
      {input('email', 'Email Address', 'email', 'email')}
      {input('phone', 'Phone Number', 'tel', 'tel', false, 'Optional. Used for pickup coordination.')}
      <div className="grid gap-5 sm:grid-cols-2">
        {input('password', 'Password', 'password', 'new-password', true, 'At least 8 characters, with a letter and a number.')}
        {input('confirm_password', 'Confirm Password', 'password', 'new-password')}
      </div>
      <div>
        <div className="flex items-start gap-2.5">
          <Checkbox id="accept_terms" checked={form.accept_terms} onCheckedChange={(v) => set('accept_terms', v === true)}
            aria-invalid={!!errors.accept_terms} className="mt-0.5" />
          <label htmlFor="accept_terms" className="text-sm leading-snug text-muted-foreground">
            I agree to the{' '}
            <Link href="/terms" target="_blank" className="font-medium text-secondary hover:underline">Terms of Service</Link> and{' '}
            <Link href="/privacy" target="_blank" className="font-medium text-secondary hover:underline">Privacy Policy</Link>.
          </label>
        </div>
        {errors.accept_terms && <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">{errors.accept_terms}</p>}
      </div>
      <Button type="submit" className="h-11 w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create Account
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-secondary hover:underline">Sign In</Link>
      </p>
    </form>
  );
}
