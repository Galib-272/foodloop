import Link from 'next/link';
import { Stagger } from '@/components/motion';
import { CheckCircle2, ListChecks, Truck } from 'lucide-react';
import { Card, PageHeader, StatCard } from '@/components/app/ui';
import { volunteerDashboard } from '@/lib/dashboard';
import { TaskList } from '@/components/app/task-list';
import type { SessionUser } from '@/lib/auth';

export function VolunteerDashboard({ user }: { user: SessionUser }) {
  const d = volunteerDashboard(user.id);
  return (
    <>
      <PageHeader eyebrow="Volunteer" title={`Hello, ${user.full_name.split(' ')[0]}`} description="Collect food from donors and deliver it to recipient organizations on time." />
      <Stagger className="grid gap-4 sm:grid-cols-3" itemClassName="h-full">
        <StatCard label="Available Tasks" icon={ListChecks} tone="green" value={d.open.length} href="/app/tasks" />
        <StatCard label="Assigned Collections" icon={Truck} tone="amber" value={d.assigned.length} href="/app/tasks/assigned" />
        <StatCard label="Completed Deliveries" icon={CheckCircle2} tone="green" value={d.completed.length} href="/app/tasks/completed" />
      </Stagger>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Your assigned collections" action={<Link href="/app/tasks/assigned" className="text-sm font-medium text-secondary hover:underline">All</Link>}>
          <TaskList tasks={d.assigned} mode="assigned" compact />
        </Card>
        <Card title="Open tasks near you" action={<Link href="/app/tasks" className="text-sm font-medium text-secondary hover:underline">All</Link>}>
          <TaskList tasks={d.open} mode="open" compact />
        </Card>
      </div>
    </>
  );
}
