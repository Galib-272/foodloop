'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FormAlert } from '@/components/forms/field';
import { apiFetch } from '@/lib/client';

const DEMO = [
  ['Donor', 'donor@foodsphere.test'],
  ['Recipient', 'recipient@foodsphere.test'],
  ['Volunteer', 'volunteer@foodsphere.test'],
  ['Admin', 'admin@foodsphere.test'],
];

export function LoginForm({ notice }: { notice?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setFormError(null);
    const { data, error } = await apiFetch<{ redirect: string }>('/api/auth/login', { body: { email, password } });
    setLoading(false);
    if (error) {
      setErrors(error.fields ?? {});
      setFormError(error.message);
      return;
    }
    router.push(data!.redirect);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-5" noValidate>
        <FormAlert message={notice} tone="info" />
        <FormAlert message={formError} />
        <Field id="email" label="Email Address" error={errors.email} required>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} />
        </Field>
        <Field id="password" label="Password" error={errors.password} required>
          <Input id="password" type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined} />
        </Field>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm font-medium text-secondary hover:underline">Forgot Password?</Link>
        </div>
        <Button type="submit" className="h-11 w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign In
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          New to FoodSphere AI?{' '}
          <Link href="/register" className="font-semibold text-secondary hover:underline">Create Account</Link>
        </p>
      </form>

      <div className="rounded-xl border border-dashed bg-muted/50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Demo accounts</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Seeded with simulated demo data. Password for all: <code className="font-semibold text-foreground">Demo@1234</code>
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {DEMO.map(([label, em]) => (
            <button key={em} type="button" onClick={() => { setEmail(em); setPassword('Demo@1234'); }}
              className="rounded-md border bg-card px-3 py-2 text-left text-xs transition-colors hover:border-secondary hover:bg-accent">
              <span className="block font-semibold">{label}</span>
              <span className="block truncate text-muted-foreground">{em}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
