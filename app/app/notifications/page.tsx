import Link from 'next/link';
import { Bell } from 'lucide-react';
import { ActionButton } from '@/components/app/action-button';
import { EmptyState, PageHeader } from '@/components/app/ui';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { sweepDeadlines } from '@/lib/donations';
import { fmtDateTime, relTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { StaggerItem, StaggerList } from '@/components/motion';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Notifications — FoodSphere AI' };

export default function Notifications() {
  const user = requireUser();
  sweepDeadlines();
  const rows = getDb().prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 200').all(user.id);
  const unread = rows.filter((r) => !r.is_read).length;
  return (
    <>
      <PageHeader title="Notifications" description={`${unread} unread`}
        actions={unread ? <ActionButton endpoint="/api/notifications" method="PATCH" body={{ all: true }} label="Mark all as read" variant="outline" size="default" /> : undefined} />
      {rows.length === 0 ? <EmptyState icon={Bell} title="No notifications yet" /> : (
        <StaggerList gap={0.03} className="divide-y overflow-hidden rounded-xl border bg-card">
          {rows.map((n) => (
            <StaggerItem key={n.id} className={cn('flex gap-3 p-4', !n.is_read && 'bg-accent/40')}>
              <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', n.is_read ? 'bg-border' : 'bg-secondary')} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{n.title}{!n.is_read && <span className="ml-2 text-xs font-semibold text-secondary">New</span>}</p>
                <p className="text-sm text-muted-foreground">{n.message}</p>
                <p className="mt-1 text-xs text-muted-foreground" title={fmtDateTime(String(n.created_at))}>{relTime(String(n.created_at))}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {n.link && <Link href={String(n.link)} className="text-sm font-medium text-secondary hover:underline">Open</Link>}
                {!n.is_read && <ActionButton endpoint="/api/notifications" method="PATCH" body={{ ids: [Number(n.id)] }} label="Mark read" variant="ghost" />}
              </div>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </>
  );
}
