import Link from 'next/link';
import { Flag } from 'lucide-react';
import { ActionButton } from '@/components/app/action-button';
import { EmptyState, PageHeader, Pill, StatusBadge } from '@/components/app/ui';
import { listReports } from '@/lib/admin';
import { did, fmtDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reported Issues — FoodSphere AI' };

export default function Reports() {
  const reports = listReports();
  return (
    <>
      <PageHeader title="Reported Issues" description="Reports from donors, recipients and volunteers. Resolutions are recorded in the audit log and shared with the reporter." />
      {reports.length === 0 ? <EmptyState icon={Flag} title="No reports" /> : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id} className="rounded-xl border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{r.reason}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.donation_id ? <><Link href={`/app/donations/${r.donation_id}`} className="font-medium text-secondary hover:underline">{did(Number(r.donation_id))} · {r.item_name}</Link> · </> : null}
                    by {r.reporter_name} ({r.reporter_role}) · {fmtDateTime(String(r.created_at))}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {r.donation_status && <StatusBadge status={String(r.donation_status)} />}
                  <Pill tone={r.status === 'open' ? 'red' : 'default'}>{r.status === 'open' ? 'Open' : r.status === 'resolved' ? 'Resolved' : 'Dismissed'}</Pill>
                </div>
              </div>
              {r.details && <p className="mt-3 rounded-lg bg-muted p-3 text-sm">{r.details}</p>}
              {r.status === 'open' ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionButton endpoint={`/api/admin/reports/${r.id}`} method="PATCH" body={{ status: 'resolved' }} label="Resolve"
                    confirm={{ title: 'Resolve this report', reason: { label: 'Resolution (shared with the reporter)', required: true, field: 'resolution' }, confirmLabel: 'Resolve' }} />
                  <ActionButton endpoint={`/api/admin/reports/${r.id}`} method="PATCH" body={{ status: 'dismissed' }} label="Dismiss" variant="outline"
                    confirm={{ title: 'Dismiss this report', reason: { label: 'Reason (shared with the reporter)', required: true, field: 'resolution' }, confirmLabel: 'Dismiss' }} />
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">{r.resolution} — {r.resolver_name}, {fmtDateTime(String(r.resolved_at))}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
