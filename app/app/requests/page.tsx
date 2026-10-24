import Link from 'next/link';
import { ActionButton } from '@/components/app/action-button';
import { DeadlineBadge, PageHeader, Pill, StatusBadge, Table, EmptyState } from '@/components/app/ui';
import { requireUser } from '@/lib/auth';
import { recipientRequests } from '@/lib/recipient-queries';
import { did, fmtDateTime, qty } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My Requests — FoodSphere AI' };

const REQ: Record<string, [string, 'blue' | 'amber' | 'green' | 'default' | 'red']> = {
  pending: ['Pending', 'blue'], offered: ['Offered to you', 'amber'], accepted: ['Accepted', 'green'], rejected: ['Not accepted', 'default'], withdrawn: ['Withdrawn', 'default'], cancelled: ['Cancelled', 'red'],
};

export default function Requests() {
  const user = requireUser(['recipient']);
  const rows = recipientRequests(user.id);
  return (
    <>
      <PageHeader title="My Requests" description="Requests you have sent and offers donors have made to you." />
      <Table head={['Donation ID', 'Donor', 'Food', 'Quantity', 'Request Date', 'Collection Deadline', 'Request', 'Donation', 'Action']}
        empty={rows.length === 0 ? <div className="p-6"><EmptyState title="No requests yet" action={<Link href="/app/available" className="text-sm font-semibold text-secondary hover:underline">Browse donations</Link>} /></div> : null}>
        {rows.map((r) => {
          const [label, tone] = REQ[String(r.status)] ?? [String(r.status), 'default'];
          const open = ['available', 'requested'].includes(String(r.donation_status));
          return (
            <tr key={r.id} className="hover:bg-muted/40">
              <td className="px-4 py-3 font-mono text-xs font-semibold">{did(Number(r.donation_id))}</td>
              <td className="px-4 py-3">{r.donor_org}</td>
              <td className="px-4 py-3"><span className="font-medium">{r.item_name}</span><span className="block text-xs text-muted-foreground">{r.food_category}</span></td>
              <td className="px-4 py-3 whitespace-nowrap">{qty(Number(r.quantity_available), String(r.unit))}</td>
              <td className="px-4 py-3 whitespace-nowrap">{fmtDateTime(String(r.request_time))}</td>
              <td className="px-4 py-3 whitespace-nowrap">{fmtDateTime(String(r.safe_until))}{open && <DeadlineBadge iso={String(r.safe_until)} />}</td>
              <td className="px-4 py-3"><Pill tone={tone}>{label}</Pill></td>
              <td className="px-4 py-3"><StatusBadge status={String(r.donation_status)} /></td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {r.status === 'pending' && open && <ActionButton endpoint={`/api/donations/${r.donation_id}/withdraw`} label="Withdraw" variant="outline" success="Request withdrawn" />}
                  {r.status === 'offered' && open && <ActionButton endpoint={`/api/donations/${r.donation_id}/respond-offer`} body={{ accept: true }} label="Accept" success="Offer accepted" />}
                  <Link href={`/app/donations/${r.donation_id}`} className="self-center text-sm font-medium text-secondary hover:underline">Coordinate</Link>
                </div>
              </td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
