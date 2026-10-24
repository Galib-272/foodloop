import { ActionButton } from '@/components/app/action-button';

export function VerificationActions({ userId, status }: { userId: number; status: string | null }) {
  if (!status) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {status !== 'verified' && <ActionButton endpoint={`/api/admin/users/${userId}/verification`} method="PATCH" body={{ status: 'verified' }} label="Approve" success="Organization verified"
        confirm={{ title: 'Approve verification?', description: 'The organization will be able to publish or request donations.', reason: { label: 'Note (optional)' }, confirmLabel: 'Approve' }} />}
      {status !== 'rejected' && <ActionButton endpoint={`/api/admin/users/${userId}/verification`} method="PATCH" body={{ status: 'rejected' }} label="Reject" variant="outline"
        confirm={{ title: 'Reject verification?', reason: { label: 'Reason (shared with the organization)', required: true }, confirmLabel: 'Reject', destructive: true }} />}
    </div>
  );
}

export function AccountActions({ userId, status, self }: { userId: number; status: string; self: boolean }) {
  if (self) return <span className="text-xs text-muted-foreground">You</span>;
  return status === 'active' ? (
    <ActionButton endpoint={`/api/admin/users/${userId}/status`} method="PATCH" body={{ status: 'suspended' }} label="Suspend" variant="ghost"
      confirm={{ title: 'Suspend this account?', description: 'The user is signed out and cannot sign in until reactivated.', reason: { label: 'Reason (recorded in audit log)', required: true }, confirmLabel: 'Suspend', destructive: true }} />
  ) : (
    <ActionButton endpoint={`/api/admin/users/${userId}/status`} method="PATCH" body={{ status: 'active' }} label="Reactivate" variant="outline"
      confirm={{ title: 'Reactivate this account?', reason: { label: 'Reason (recorded in audit log)', required: true }, confirmLabel: 'Reactivate' }} />
  );
}
