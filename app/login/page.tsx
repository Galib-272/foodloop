import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { LoginForm } from '@/components/auth/login-form';
import { getCurrentUser, homeFor } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign In — FoodSphere AI' };

export default function LoginPage({ searchParams }: { searchParams: { suspended?: string; reset?: string } }) {
  const user = getCurrentUser();
  if (user && user.account_status === 'active') redirect(homeFor(user.role));
  const notice = searchParams.suspended
    ? 'Your account is suspended. Please contact support.'
    : searchParams.reset
      ? 'Your password has been reset. Please sign in.'
      : undefined;
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your FoodSphere AI account.">
      <LoginForm notice={notice} />
    </AuthShell>
  );
}
