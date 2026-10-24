import { ShieldCheck } from 'lucide-react';
import { Card, EmptyState, PageHeader, VerificationBadge } from '@/components/app/ui';
import { VerificationActions } from '@/components/admin/user-actions';
import { listUsers } from '@/lib/admin';
import { fmtDateTime } from '@/lib/format';
import { STORAGE_LABEL, type Storage } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Verification Requests — FoodSphere AI' };

export default function Verifications() {
  const pending = listUsers({ verification: 'pending' });
  const rejected = listUsers({ verification: 'rejected' });
  const block = (u: (typeof pending)[number]) => {
    const cats: string[] = JSON.parse(String(u.accepted_categories ?? '[]'));
    const storage: string[] = JSON.parse(String(u.storage_capabilities ?? '[]'));
    return (
      <Card key={u.id} title={<span className="flex flex-wrap items-center gap-2">{u.organization_name}<VerificationBadge status={String(u.verification_status)} /></span>}
        description={`${u.organization_type} · ${u.role === 'donor' ? 'Donor' : 'Recipient'} · submitted ${fmtDateTime(String(u.created_at))}`}
        action={<VerificationActions userId={Number(u.id)} status={String(u.verification_status)} />}>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-muted-foreground">Account holder</dt><dd>{u.full_name} · {u.email}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Contact person</dt><dd>{u.contact_person ?? '—'} {u.phone ? `· ${u.phone}` : ''}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Address</dt><dd>{u.address} ({u.area})</dd></div>
          <div><dt className="text-xs text-muted-foreground">Verification details</dt><dd>{u.verification_details ?? <span className="text-amber-700">None provided</span>}</dd></div>
          {u.role === 'recipient' && <>
            <div><dt className="text-xs text-muted-foreground">Accepted categories</dt><dd>{cats.join(', ') || '—'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Storage · capacity</dt><dd>{storage.map((s) => STORAGE_LABEL[s as Storage]?.split(' (')[0]).join(', ')} · {u.receiving_capacity} kg-eq/day</dd></div>
          </>}
          {u.verification_note && <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Previous note</dt><dd>{u.verification_note}</dd></div>}
        </dl>
      </Card>
    );
  };
  return (
    <>
      <PageHeader title="Verification Requests" description="Only verified organizations can publish (donors) or request (recipients) donations." />
      {pending.length === 0 ? <EmptyState icon={ShieldCheck} title="No pending verification requests" /> : <div className="space-y-4">{pending.map(block)}</div>}
      {rejected.length > 0 && <><h2 className="mb-3 mt-8 font-semibold">Rejected</h2><div className="space-y-4">{rejected.map(block)}</div></>}
    </>
  );
}
