import { PageHeader, Pill, Table, VerificationBadge, EmptyState } from '@/components/app/ui';
import { FilterBar } from '@/components/app/filter-bar';
import { AccountActions, VerificationActions } from '@/components/admin/user-actions';
import { requireUser } from '@/lib/auth';
import { listUsers } from '@/lib/admin';
import { ROLE_LABEL, ROLES, VERIFICATION, VERIFICATION_LABEL, type Role } from '@/lib/constants';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'User Management — FoodSphere AI' };

export default function Users({ searchParams }: { searchParams: { q?: string; role?: string; verification?: string } }) {
  const me = requireUser(['admin']);
  const users = listUsers({ q: searchParams.q, role: searchParams.role || undefined, verification: searchParams.verification || undefined });
  return (
    <>
      <PageHeader title="User Management" description="Search users, review profiles, verify organizations and suspend or reactivate accounts. Every change is audit-logged with a reason." />
      <FilterBar q={searchParams.q} placeholder="Search name, email or organization"
        selects={[
          { name: 'role', label: 'Role', value: searchParams.role, options: ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] })) },
          { name: 'verification', label: 'Verification', value: searchParams.verification, options: VERIFICATION.map((v) => ({ value: v, label: VERIFICATION_LABEL[v] })) },
        ]} />
      <Table head={['User', 'Role', 'Organization', 'Verification', 'Account', 'Joined', 'Actions']}
        empty={users.length === 0 ? <div className="p-6"><EmptyState title="No users match" /></div> : null}>
        {users.map((u) => (
          <tr key={u.id} className="align-top hover:bg-muted/40">
            <td className="px-4 py-3"><span className="font-medium">{u.full_name}</span>{u.is_demo ? <span className="ml-1.5 text-[10px] font-semibold uppercase text-muted-foreground">demo</span> : null}<span className="block text-xs text-muted-foreground">{u.email}</span></td>
            <td className="px-4 py-3">{ROLE_LABEL[u.role as Role]}</td>
            <td className="px-4 py-3">{u.organization_name ? <>{u.organization_name}<span className="block text-xs text-muted-foreground">{u.organization_type} · {u.area}</span></> : '—'}</td>
            <td className="px-4 py-3">{u.verification_status ? <VerificationBadge status={String(u.verification_status)} /> : '—'}</td>
            <td className="px-4 py-3"><Pill tone={u.account_status === 'active' ? 'green' : 'red'}>{u.account_status === 'active' ? 'Active' : 'Suspended'}</Pill></td>
            <td className="px-4 py-3 whitespace-nowrap">{fmtDate(String(u.created_at))}</td>
            <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5"><VerificationActions userId={Number(u.id)} status={u.verification_status as string | null} /><AccountActions userId={Number(u.id)} status={String(u.account_status)} self={Number(u.id) === me.id} /></div></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
