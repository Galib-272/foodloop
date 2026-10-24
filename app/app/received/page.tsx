import Link from 'next/link';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader, Pill, Table } from '@/components/app/ui';
import { requireUser } from '@/lib/auth';
import { recipientRequests } from '@/lib/recipient-queries';
import { did, fmtDateTime, qty } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Received Donations — FoodSphere AI' };

export default function Received() {
  const user = requireUser(['recipient']);
  const rows = recipientRequests(user.id).filter((r) => r.status === 'accepted' && r.donation_status === 'delivered');
  return (
    <>
      <PageHeader title="Received Donations" description="Donations your organization has confirmed receiving."
        actions={<Button asChild variant="outline"><a href="/api/analytics/export"><Download className="mr-2 h-4 w-4" />Export CSV</a></Button>} />
      <Table head={['Donation ID', 'Donor', 'Food', 'Offered', 'Received', 'Delivered', 'As expected']}
        empty={rows.length === 0 ? <div className="p-6"><EmptyState title="Nothing received yet" /></div> : null}>
        {rows.map((r) => (
          <tr key={r.id} className="hover:bg-muted/40">
            <td className="px-4 py-3 font-mono text-xs font-semibold"><Link href={`/app/donations/${r.donation_id}`} className="hover:underline">{did(Number(r.donation_id))}</Link></td>
            <td className="px-4 py-3">{r.donor_org}</td>
            <td className="px-4 py-3"><span className="font-medium">{r.item_name}</span><span className="block text-xs text-muted-foreground">{r.food_category}</span></td>
            <td className="px-4 py-3 whitespace-nowrap">{qty(Number(r.quantity_available), String(r.unit))}</td>
            <td className="px-4 py-3 whitespace-nowrap font-semibold">{qty(Number(r.quantity_delivered), String(r.unit))}</td>
            <td className="px-4 py-3 whitespace-nowrap">{fmtDateTime(String(r.actual_delivery_time))}</td>
            <td className="px-4 py-3">{Number(r.received_as_expected) === 0 ? <Pill tone="amber">Discrepancy: {String(r.discrepancy ?? '')}</Pill> : <Pill tone="green">Yes</Pill>}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
