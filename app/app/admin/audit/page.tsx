import { PageHeader, Table, EmptyState } from '@/components/app/ui';
import { FilterBar } from '@/components/app/filter-bar';
import { auditLogs } from '@/lib/admin';
import { fmtDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Audit Logs — FoodSphere AI' };

const ENTITIES = ['user', 'organization', 'donation', 'inventory', 'csv_import', 'report', 'settings'];

export default function Audit({ searchParams }: { searchParams: { q?: string; entity?: string } }) {
  const logs = auditLogs({ q: searchParams.q, entity: searchParams.entity || undefined });
  return (
    <>
      <PageHeader title="Audit Logs" description="Append-only record of important administrative and donation actions. Entries cannot be edited or deleted from the application." />
      <FilterBar q={searchParams.q} placeholder="Search action, reason or actor"
        selects={[{ name: 'entity', label: 'Entity', value: searchParams.entity, options: ENTITIES.map((e) => ({ value: e, label: e.replace('_', ' ') })) }]} />
      <Table head={['Time', 'Actor', 'Action', 'Entity', 'Reason', 'Details']}
        empty={logs.length === 0 ? <div className="p-6"><EmptyState title="No entries" /></div> : null}>
        {logs.map((l) => (
          <tr key={l.id} className="align-top">
            <td className="px-4 py-2.5 whitespace-nowrap">{fmtDateTime(String(l.timestamp))}</td>
            <td className="px-4 py-2.5">{l.actor_name ?? 'System'}<span className="block text-xs text-muted-foreground">{l.actor_role ?? ''}</span></td>
            <td className="px-4 py-2.5 font-mono text-xs">{l.action}</td>
            <td className="px-4 py-2.5 whitespace-nowrap">{l.entity_type}{l.entity_id != null ? ` #${l.entity_id}` : ''}</td>
            <td className="px-4 py-2.5">{l.reason ?? '—'}</td>
            <td className="max-w-xs px-4 py-2.5"><code className="break-all text-[11px] text-muted-foreground">{l.relevant_metadata ?? ''}</code></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
