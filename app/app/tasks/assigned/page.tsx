import { PageHeader } from '@/components/app/ui';
import { TaskList } from '@/components/app/task-list';
import { requireUser } from '@/lib/auth';
import { volunteerDashboard } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Assigned Collections — FoodSphere AI' };

export default function Page() {
  const user = requireUser(['volunteer']);
  const d = volunteerDashboard(user.id);
  return (
    <>
      <PageHeader title="Assigned Collections" description="Tasks you have accepted. Update the status as you go." />
      <div className="max-w-3xl"><TaskList tasks={d.assigned} mode="assigned" /></div>
    </>
  );
}
