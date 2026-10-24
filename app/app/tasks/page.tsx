import { PageHeader } from '@/components/app/ui';
import { TaskList } from '@/components/app/task-list';
import { requireUser } from '@/lib/auth';
import { volunteerDashboard } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Available Tasks — FoodSphere AI' };

export default function Page() {
  const user = requireUser(['volunteer']);
  const d = volunteerDashboard(user.id);
  return (
    <>
      <PageHeader title="Available Tasks" description="Collections where the recipient asked for volunteer help. Exact addresses are shared after you accept." />
      <div className="max-w-3xl"><TaskList tasks={d.open} mode="open" /></div>
    </>
  );
}
