import Link from 'next/link';
import { ArrowRight, MapPin } from 'lucide-react';
import { ActionButton } from '@/components/app/action-button';
import { DeadlineBadge, EmptyState, Pill } from '@/components/app/ui';
import { did, fmtDateTime, qty } from '@/lib/format';
import { TASK_STATUS_LABEL, type TaskStatus } from '@/lib/constants';
import { StaggerItem, StaggerList } from '@/components/motion';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Task = Record<string, any>;

export function TaskList({ tasks, mode, compact }: { tasks: Task[]; mode: 'open' | 'assigned' | 'completed'; compact?: boolean }) {
  if (!tasks.length)
    return compact ? <p className="text-sm text-muted-foreground">Nothing here right now.</p> : (
      <EmptyState title={mode === 'open' ? 'No open tasks' : mode === 'assigned' ? 'No assigned collections' : 'No completed deliveries yet'}>
        {mode === 'open' ? 'You will be notified when a recipient asks for volunteer help.' : undefined}
      </EmptyState>
    );
  return (
    <StaggerList className="space-y-3">
      {tasks.map((t) => {
        const id = Number(t.donation_id);
        const ts = String(t.task_status) as TaskStatus;
        return (
          <StaggerItem key={t.id} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{t.item_name} <span className="font-mono text-xs font-normal text-muted-foreground">{did(id)}</span></p>
                <p className="text-sm text-muted-foreground">{t.food_category} · {qty(Number(t.quantity_available), String(t.unit))}</p>
              </div>
              <Pill tone={ts === 'delivered' ? 'green' : ts === 'failed' ? 'red' : ts === 'unassigned' ? 'default' : 'blue'}>{TASK_STATUS_LABEL[ts] ?? ts}</Pill>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />{t.pickup_area}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-label="to" />
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />{mode === 'open' ? t.delivery_area : `${t.recipient_org} (${t.delivery_area})`}</span>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div><dt className="text-muted-foreground">Pickup by</dt><dd className="font-medium">{fmtDateTime(t.scheduled_pickup_time)}</dd></div>
              <div><dt className="text-muted-foreground">Deliver before</dt><dd className="font-medium">{fmtDateTime(t.safe_until)}</dd>{mode !== 'completed' && <DeadlineBadge iso={String(t.safe_until)} />}</div>
            </dl>
            {mode === 'open' && <p className="mt-2 text-xs text-muted-foreground">Exact addresses and contacts are shared after you accept the task.</p>}
            <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
              {mode === 'open' && <ActionButton endpoint={`/api/donations/${id}/task`} body={{ action: 'claim' }} label="Accept task" success="Task accepted" />}
              {mode === 'assigned' && (
                <>
                  {ts === 'assigned' && <ActionButton endpoint={`/api/donations/${id}/task`} body={{ action: 'accept' }} label="Accept" />}
                  {['assigned', 'accepted'].includes(ts) && <ActionButton endpoint={`/api/donations/${id}/task`} body={{ action: 'at_pickup' }} label="I’m at pickup" variant="outline" />}
                  {['accepted', 'at_pickup', 'assigned'].includes(ts) && t.donation_status === 'scheduled' && (
                    <ActionButton endpoint={`/api/donations/${id}/task`} body={{ action: 'collected' }} label="Confirm pickup" success="Pickup recorded"
                      confirm={{ title: 'Confirm pickup', number: { label: `Quantity collected (${t.unit})`, field: 'quantity', defaultValue: Number(t.quantity_available), max: Number(t.quantity_available) }, confirmLabel: 'Confirm pickup' }} />
                  )}
                  {t.donation_status === 'collected' && ts !== 'delivered' && (
                    <ActionButton endpoint={`/api/donations/${id}/task`} body={{ action: 'delivered' }} label="Confirm delivery" success="Delivery recorded — recipient will confirm"
                      confirm={{ title: 'Record delivery', description: 'The recipient organization will confirm the quantity received.', number: { label: `Quantity delivered (${t.unit})`, field: 'quantity', defaultValue: Number(t.quantity_collected ?? t.quantity_available), max: Number(t.quantity_available) }, reason: { label: 'Notes or issues (optional)' }, confirmLabel: 'Record delivery' }} />
                  )}
                  {!['delivered', 'collected'].includes(ts) && (
                    <ActionButton endpoint={`/api/donations/${id}/task`} body={{ action: 'decline' }} label="Decline" variant="ghost"
                      confirm={{ title: 'Decline this task?', description: 'The task will be opened to other volunteers.', confirmLabel: 'Decline task' }} />
                  )}
                  <ActionButton endpoint={`/api/donations/${id}/task`} body={{ action: 'failed' }} label="Report failure" variant="ghost"
                    confirm={{ title: 'Report a failed collection', reason: { label: 'What happened?', required: true }, confirmLabel: 'Report failure', destructive: true }} />
                </>
              )}
              <Link href={`/app/donations/${id}`} className="ml-auto self-center text-sm font-medium text-secondary hover:underline">Details</Link>
            </div>
          </StaggerItem>
        );
      })}
    </StaggerList>
  );
}
