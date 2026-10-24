import { z } from 'zod';
import { apiUser, handle, idParam, parseBody } from '@/lib/api';
import { setVerification } from '@/lib/admin';

export const dynamic = 'force-dynamic';
export const PATCH = handle<{ params: { id: string } }>(async (req, { params }) => {
  const admin = apiUser(['admin']);
  const b = await parseBody(req, z.object({ status: z.enum(['verified', 'rejected', 'pending', 'suspended']), reason: z.string().trim().max(500).optional() }));
  return setVerification(admin, idParam(params.id), b.status, b.reason);
});
