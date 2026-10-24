import { apiUser, handle } from '@/lib/api';
import { modelMonitoring } from '@/lib/admin';

export const dynamic = 'force-dynamic';
export const GET = handle(async () => {
  apiUser(['admin']);
  return modelMonitoring();
});
