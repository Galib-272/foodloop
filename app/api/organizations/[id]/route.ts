import { apiUser, handle, idParam, notFound } from '@/lib/api';
import { getOrg } from '@/lib/orgs';

export const dynamic = 'force-dynamic';

// Public-safe organization summary. Contact details only for admins or the owner.
export const GET = handle<{ params: { id: string } }>(async (_req, { params }) => {
  const user = apiUser();
  const org = getOrg(idParam(params.id));
  if (!org) throw notFound();
  const full = user.role === 'admin' || org.user_id === user.id;
  return {
    organization: full
      ? org
      : {
          id: org.id,
          kind: org.kind,
          organization_name: org.organization_name,
          organization_type: org.organization_type,
          area: org.area,
          verification_status: org.verification_status,
          accepted_categories: org.accepted_categories,
        },
  };
});
