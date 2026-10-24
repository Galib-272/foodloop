import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { RegisterForm } from '@/components/auth/register-form';
import { getCurrentUser, homeFor } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Create Account — FoodSphere AI' };

export default function RegisterPage({ searchParams }: { searchParams: { role?: string } }) {
  const user = getCurrentUser();
  if (user && user.account_status === 'active') redirect(homeFor(user.role));
  return (
    <AuthShell title="Create your account" subtitle="Join a coordinated food rescue network. Organization details come next.">
      <RegisterForm initialRole={searchParams.role} />
    </AuthShell>
  );
}
