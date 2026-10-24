import { Card, Notice, PageHeader, VerificationBadge } from '@/components/app/ui';
import { OrgForm, type OrgFormValues } from '@/components/org/org-form';
import { AccountForm } from '@/components/org/account-form';
import { requireUser } from '@/lib/auth';
import { getOrgByUser } from '@/lib/orgs';
import { ROLE_LABEL } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Profile & Settings — FoodSphere AI' };

export default function Settings() {
  const user = requireUser();
  const org = user.role === 'donor' || user.role === 'recipient' ? getOrgByUser(user.id) : null;
  const initial: OrgFormValues | null = org
    ? {
        organization_name: org.organization_name, organization_type: org.organization_type, address: org.address, area: org.area,
        latitude: org.latitude, longitude: org.longitude, phone: org.phone ?? '', contact_person: org.contact_person ?? '',
        operating_hours_open: org.operating_hours_open, operating_hours_close: org.operating_hours_close, verification_details: org.verification_details ?? '',
        accepted_categories: org.accepted_categories, storage_capabilities: org.storage_capabilities, receiving_capacity: org.receiving_capacity, required_quantity: org.required_quantity,
      }
    : null;
  return (
    <div className="max-w-4xl">
      <PageHeader title={user.role === 'recipient' ? 'Organization Profile' : 'Profile & Settings'} description={`${ROLE_LABEL[user.role]} · ${user.email}`} />
      {org && (
        <Card className="mb-6" title={<span className="flex items-center gap-2">Verification status <VerificationBadge status={org.verification_status} /></span>}>
          {org.verification_status === 'verified' && <p className="text-sm text-muted-foreground">Your organization is verified.</p>}
          {org.verification_status === 'pending' && <p className="text-sm text-muted-foreground">An administrator is reviewing your verification details.</p>}
          {(org.verification_status === 'rejected' || org.verification_status === 'suspended') && (
            <Notice tone="warning">{org.verification_note ? `Reason: ${org.verification_note}. ` : ''}Update your details below and contact support to request another review.</Notice>
          )}
        </Card>
      )}
      <Card className="mb-6" title="Account"><AccountForm fullName={user.full_name} phone={user.phone ?? ''} /></Card>
      {org && initial && (
        <Card title={org.kind === 'donor' ? 'Business profile' : 'Organization profile'}>
          <OrgForm kind={org.kind} initial={initial} mode="update" />
        </Card>
      )}
    </div>
  );
}
