import { PageHeader } from '@/components/app/ui';
import { TaskList } from '@/components/app/task-list';
import { requireUser } from '@/lib/auth';
import { volunteerDashboard } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Completed Deliveries — FoodSphere AI' };

export default function Page() {
  const user = requireUser(['volunteer']);
  const d = volunteerDashboard(user.id);
  return (
    <>
      <PageHeader title="Completed Deliveries" description="Deliveries you have completed." />
      <div className="max-w-3xl"><TaskList tasks={d.completed} mode="completed" /></div>
    </>
  );
}
