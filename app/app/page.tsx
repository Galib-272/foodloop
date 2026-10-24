import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { DonorDashboard } from '@/components/dashboards/donor';
import { RecipientDashboard } from '@/components/dashboards/recipient';
import { VolunteerDashboard } from '@/components/dashboards/volunteer';
import { Notice } from '@/components/app/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard — FoodSphere AI' };

export default function DashboardPage({ searchParams }: { searchParams: { denied?: string } }) {
  const user = requireUser();
  if (user.role === 'admin') redirect('/app/admin');
  return (
    <>
      {searchParams.denied && <div className="mb-4"><Notice tone="warning">You do not have access to that page.</Notice></div>}
      {user.role === 'donor' && <DonorDashboard user={user} />}
      {user.role === 'recipient' && <RecipientDashboard user={user} />}
      {user.role === 'volunteer' && <VolunteerDashboard user={user} />}
    </>
  );
}
