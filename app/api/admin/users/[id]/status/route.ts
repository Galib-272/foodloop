import { z } from 'zod';
import { apiUser, handle, idParam, parseBody } from '@/lib/api';
import { setAccountStatus } from '@/lib/admin';

export const dynamic = 'force-dynamic';
export const PATCH = handle<{ params: { id: string } }>(async (req, { params }) => {
  const admin = apiUser(['admin']);
  const b = await parseBody(req, z.object({ status: z.enum(['active', 'suspended']), reason: z.string().trim().min(3, 'A reason is required.').max(500) }));
  return setAccountStatus(admin, idParam(params.id), b.status, b.reason);
});
