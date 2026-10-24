import { z } from 'zod';
import { apiUser, handle, idParam, parseBody } from '@/lib/api';
import { resolveReport } from '@/lib/admin';

export const dynamic = 'force-dynamic';
export const PATCH = handle<{ params: { id: string } }>(async (req, { params }) => {
  const admin = apiUser(['admin']);
  const b = await parseBody(req, z.object({ status: z.enum(['resolved', 'dismissed']), resolution: z.string().trim().min(3, 'Describe the resolution.').max(1000) }));
  return resolveReport(admin, idParam(params.id), b.status, b.resolution);
});
