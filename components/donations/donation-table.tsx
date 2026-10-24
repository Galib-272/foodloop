import Link from 'next/link';
import { DeadlineBadge, EmptyState, StatusBadge, Table } from '@/components/app/ui';
import type { Donation } from '@/lib/donations';
import { did, fmtDateTime, qty } from '@/lib/format';

export function DonationTable({ rows, showDonor, emptyTitle = 'No donations found', emptyAction }: { rows: Donation[]; showDonor?: boolean; emptyTitle?: string; emptyAction?: React.ReactNode }) {
  return (
    <Table head={['Donation ID', 'Food', 'Quantity', ...(showDonor ? ['Donor'] : []), 'Safe-Use Deadline', 'Status', 'Actions']}
      empty={rows.length === 0 ? <div className="p-6"><EmptyState title={emptyTitle} action={emptyAction} /></div> : null}>
      {rows.map((r) => (
        <tr key={r.id} className="hover:bg-muted/40">
          <td className="px-4 py-3 font-mono text-xs font-semibold">{did(r.id)}</td>
          <td className="px-4 py-3"><span className="font-medium">{r.item_name}</span><span className="block text-xs text-muted-foreground">{r.food_category}</span></td>
          <td className="px-4 py-3 whitespace-nowrap">{qty(r.quantity_available, r.unit)}</td>
          {showDonor && <td className="px-4 py-3">{r.donor_org}<span className="block text-xs text-muted-foreground">{r.area}</span></td>}
          <td className="px-4 py-3">
            <span className="block whitespace-nowrap">{fmtDateTime(r.safe_until)}</span>
            {['available', 'requested', 'accepted', 'scheduled'].includes(r.status) && <DeadlineBadge iso={r.safe_until} />}
          </td>
          <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
          <td className="px-4 py-3"><Link href={`/app/donations/${r.id}`} className="font-medium text-secondary hover:underline">View<span className="sr-only"> {did(r.id)}</span></Link></td>
        </tr>
      ))}
    </Table>
  );
}
