'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FormAlert } from '@/components/forms/field';
import { apiFetch } from '@/lib/client';

export function ForgotForm() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<{ text: string; tone: 'error' | 'success' } | null>(null);
  const [fieldErr, setFieldErr] = useState<string>();
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await apiFetch<{ message: string }>('/api/auth/forgot-password', { body: { email } });
    setLoading(false);
    setFieldErr(error?.fields?.email);
    setMsg(error ? { text: error.message, tone: 'error' } : { text: data!.message, tone: 'success' });
  }
  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <FormAlert message={msg?.text} tone={msg?.tone} />
      <Field id="email" label="Email Address" error={fieldErr} required>
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Button type="submit" className="h-11 w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send Reset Link
      </Button>
      <p className="text-xs text-muted-foreground">
        No email service is configured in this build. In development, the reset link is printed in the terminal running <code>npm run dev</code>.
      </p>
      <p className="text-center text-sm"><Link href="/login" className="font-semibold text-secondary hover:underline">Back to Sign In</Link></p>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ password: '', confirm_password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await apiFetch('/api/auth/reset-password', { body: { token, ...form } });
    setLoading(false);
    if (error) {
      setErrors(error.fields ?? {});
      setFormError(error.message);
      return;
    }
    router.push('/login?reset=1');
  }
  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <FormAlert message={formError} />
      <Field id="password" label="New Password" error={errors.password} required hint="At least 8 characters, with a letter and a number.">
        <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      </Field>
      <Field id="confirm_password" label="Confirm Password" error={errors.confirm_password} required>
        <Input id="confirm_password" type="password" autoComplete="new-password" value={form.confirm_password} onChange={(e) => setForm({ ...form, confirm_password: e.target.value })} />
      </Field>
      <Button type="submit" className="h-11 w-full" disabled={loading || !token}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Reset Password
      </Button>
    </form>
  );
}
