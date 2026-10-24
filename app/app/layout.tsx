import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app/shell';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const user = requireUser();
  if ((user.role === 'donor' || user.role === 'recipient') && !user.org_id) redirect('/onboarding');
  return (
    <AppShell
      today={new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      user={{ full_name: user.full_name, email: user.email, role: user.role, org_name: user.org_name, verification_status: user.verification_status }}>
      {children}
    </AppShell>
  );
}
