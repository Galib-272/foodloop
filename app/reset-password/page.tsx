import { AuthShell } from '@/components/auth/auth-shell';
import { ResetForm } from '@/components/auth/password-forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reset Password — FoodSphere AI' };

export default function ResetPage({ searchParams }: { searchParams: { token?: string } }) {
  return (
    <AuthShell title="Choose a new password" subtitle={searchParams.token ? undefined : 'This link is missing its reset token.'}>
      <ResetForm token={searchParams.token ?? ''} />
    </AuthShell>
  );
}
