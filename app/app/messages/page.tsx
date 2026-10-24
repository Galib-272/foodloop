import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { EmptyState, PageHeader, StatusBadge } from '@/components/app/ui';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { did, fmtDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Coordination Updates — FoodSphere AI' };

// Status updates on donations you are involved in. Real-time chat is a future feature.
export default function Messages() {
  const user = requireUser();
  const scope =
    user.role === 'admin' ? '1=1'
      : user.role === 'donor' ? 'd.donor_id = ?'
        : user.role === 'recipient' ? 'EXISTS (SELECT 1 FROM donation_requests r WHERE r.donation_id = d.id AND r.recipient_id = ?)'
          : 'EXISTS (SELECT 1 FROM collections c WHERE c.donation_id = d.id AND c.assigned_volunteer_id = ?)';
  const rows = getDb()
    .prepare(
      `SELECT h.*, d.item_name, d.status AS current_status, u.full_name AS actor_name, u.role AS actor_role
       FROM donation_status_history h JOIN donations d ON d.id = h.donation_id LEFT JOIN users u ON u.id = h.actor_user_id
       WHERE ${scope} ORDER BY h.created_at DESC, h.id DESC LIMIT 100`
    )
    .all(...(user.role === 'admin' ? [] : [user.id]));
  return (
    <>
      <PageHeader title="Coordination Updates" description="Every status change on donations you are part of, with who made it and when. Use each donation’s page to coordinate." />
      {rows.length === 0 ? <EmptyState icon={MessageSquare} title="No updates yet" /> : (
        <ol className="space-y-3">
          {rows.map((h) => (
            <li key={h.id} className="flex flex-col gap-2 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-sm"><Link href={`/app/donations/${h.donation_id}`} className="font-semibold hover:underline">{h.item_name}</Link> <span className="font-mono text-xs text-muted-foreground">{did(Number(h.donation_id))}</span></p>
                <p className="text-sm text-muted-foreground">{h.note}</p>
                <p className="text-xs text-muted-foreground">{fmtDateTime(String(h.created_at))} · {h.actor_name ? `${h.actor_name} (${h.actor_role})` : 'System'}</p>
              </div>
              <StatusBadge status={String(h.current_status)} />
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
