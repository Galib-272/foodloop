import Link from 'next/link';
import { AlertTriangle, Clock, PackagePlus, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DeadlineBadge, EmptyState, PageHeader, Pill, Table } from '@/components/app/ui';
import { FilterBar } from '@/components/app/filter-bar';
import { ActionButton } from '@/components/app/action-button';
import { InventoryDialog } from './inventory-client';
import { toInvValues } from './inventory-values';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { FOOD_CATEGORIES, STORAGE_LABEL, type Storage } from '@/lib/constants';
import { fmtDate, fmtDateTime, qty } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Inventory — FoodSphere AI' };

const STATUS: Record<string, [string, 'green' | 'default' | 'amber' | 'red' | 'blue']> = {
  in_stock: ['In stock', 'green'], sold: ['Sold', 'default'], wasted: ['Wasted', 'red'], donation: ['For donation', 'blue'], archived: ['Archived', 'default'],
};

export default function InventoryPage({ searchParams }: { searchParams: { q?: string; category?: string; status?: string } }) {
  const user = requireUser(['donor']);
  const db = getDb();
  const where = ['donor_id = ?'];
  const p: (string | number)[] = [user.id];
  if (searchParams.status) { where.push('status = ?'); p.push(searchParams.status); } else where.push(`status != 'archived'`);
  if (searchParams.category) { where.push('food_category = ?'); p.push(searchParams.category); }
  if (searchParams.q) { where.push('item_name LIKE ?'); p.push(`%${searchParams.q.replace(/[%_]/g, '')}%`); }
  const rows = db.prepare(`SELECT * FROM inventory_records WHERE ${where.join(' AND ')} ORDER BY CASE status WHEN 'in_stock' THEN 0 ELSE 1 END, safe_until IS NULL, safe_until`).all(...p);

  // Average daily sales per category (last 28 days of history, in units) for stock alerts — only where history exists.
  const since = new Date(Date.now() - 28 * 86400_000).toISOString().slice(0, 10);
  const avg = new Map(db.prepare(`SELECT food_category AS k, AVG(units_sold) AS s FROM sales_history WHERE donor_id = ? AND date >= ? GROUP BY food_category`).all(user.id, since)
    .map((r) => [`${r.k}|units`, Number(r.s)]));
  const alerts: { icon: typeof Clock; text: string; tone: 'red' | 'amber' | 'blue' }[] = [];
  for (const r of rows.filter((r) => r.status === 'in_stock')) {
    const safe = r.safe_until ? Date.parse(String(r.safe_until)) : null;
    if (safe && safe - Date.now() < 48 * 3600_000 && safe > Date.now()) alerts.push({ icon: Clock, tone: 'red', text: `${r.item_name}: safe-use deadline ${fmtDateTime(String(r.safe_until))}` });
    const a = avg.get(`${String(r.food_category)}|${r.unit}`);
    if (a && Number(r.quantity) > a * 3) alerts.push({ icon: TrendingUp, tone: 'amber', text: `${r.item_name}: possible overstock (${qty(Number(r.quantity), String(r.unit))} vs ~${a.toFixed(1)} sold per day)` });
    if (a && Number(r.quantity) < a * 0.5) alerts.push({ icon: TrendingDown, tone: 'blue', text: `${r.item_name}: low stock (${qty(Number(r.quantity), String(r.unit))} vs ~${a.toFixed(1)} sold per day)` });
  }

  return (
    <>
      <PageHeader title="Inventory" description="Track stock, record sales and waste, and move surplus into donations. Quantities in different units are never added together."
        actions={<InventoryDialog />} />
      {alerts.length > 0 && (
        <section className="mb-6 rounded-xl border bg-card p-4" aria-label="Inventory alerts">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-amber-600" />Operational alerts</h2>
          <ul className="grid gap-2 md:grid-cols-2">
            {alerts.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm"><a.icon className={a.tone === 'red' ? 'mt-0.5 h-4 w-4 text-red-600' : a.tone === 'amber' ? 'mt-0.5 h-4 w-4 text-amber-600' : 'mt-0.5 h-4 w-4 text-blue-600'} aria-hidden="true" />{a.text}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Alerts are operational reminders, not food-safety determinations.</p>
        </section>
      )}
      <FilterBar q={searchParams.q} placeholder="Search items"
        selects={[
          { name: 'category', label: 'Category', value: searchParams.category, options: FOOD_CATEGORIES.map((c) => ({ value: c, label: c })) },
          { name: 'status', label: 'Status', value: searchParams.status, options: Object.entries(STATUS).map(([k, [l]]) => ({ value: k, label: l })) },
        ]} />
      <Table head={['Item Name', 'Category', 'Quantity', 'Stock Date', 'Safe-Use Deadline', 'Storage', 'Source', 'Last Updated', 'Actions']}
        empty={rows.length === 0 ? <div className="p-6"><EmptyState icon={PackagePlus} title="No inventory records" action={<InventoryDialog />}>Add stock manually to track shelf life and surplus.</EmptyState></div> : null}>
        {rows.map((r) => {
          const [label, tone] = STATUS[String(r.status)] ?? ['—', 'default'];
          const inStock = r.status === 'in_stock';
          return (
            <tr key={r.id} className="align-top hover:bg-muted/40">
              <td className="px-4 py-3"><span className="font-medium">{r.item_name}</span><span className="mt-1 block"><Pill tone={tone}>{label}</Pill></span></td>
              <td className="px-4 py-3">{r.food_category}</td>
              <td className="px-4 py-3 whitespace-nowrap">{qty(Number(r.quantity), String(r.unit))}{Number(r.wasted_quantity) > 0 && <span className="block text-xs text-red-700">{qty(Number(r.wasted_quantity), String(r.unit))} wasted</span>}</td>
              <td className="px-4 py-3 whitespace-nowrap">{fmtDate(String(r.recorded_date))}</td>
              <td className="px-4 py-3 whitespace-nowrap">{r.safe_until ? <>{fmtDateTime(String(r.safe_until))}{inStock && <DeadlineBadge iso={String(r.safe_until)} />}</> : r.shelf_life_days != null ? `${r.shelf_life_days} days shelf life` : '—'}</td>
              <td className="px-4 py-3">{STORAGE_LABEL[r.storage_requirement as Storage]?.split(' (')[0]}</td>
              <td className="px-4 py-3 capitalize">{r.source}</td>
              <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(String(r.updated_at))}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {inStock && (
                    <>
                      <Button asChild size="sm" variant="secondary"><Link href={`/app/donations/new?inventory=${r.id}`}>Donate</Link></Button>
                      <ActionButton endpoint={`/api/inventory/${r.id}`} method="PATCH" body={{ action: 'sold' }} label="Sold" variant="outline"
                        confirm={{ title: `Record sales of ${r.item_name}`, number: { label: `Quantity sold or consumed (${r.unit})`, field: 'quantity', defaultValue: Number(r.quantity), max: Number(r.quantity) }, confirmLabel: 'Record' }} />
                      <ActionButton endpoint={`/api/inventory/${r.id}`} method="PATCH" body={{ action: 'wasted' }} label="Waste" variant="outline"
                        confirm={{ title: `Record waste for ${r.item_name}`, number: { label: `Quantity wasted (${r.unit})`, field: 'quantity', defaultValue: Number(r.quantity), max: Number(r.quantity) }, confirmLabel: 'Record waste', destructive: true }} />
                      <InventoryDialog initial={toInvValues(r)} trigger={<Button size="sm" variant="ghost">Edit</Button>} />
                    </>
                  )}
                  {r.status !== 'archived'
                    ? <ActionButton endpoint={`/api/inventory/${r.id}`} method="PATCH" body={{ action: 'archive' }} label="Archive" variant="ghost" />
                    : <ActionButton endpoint={`/api/inventory/${r.id}`} method="PATCH" body={{ action: 'restore' }} label="Restore" variant="ghost" />}
                </div>
              </td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
