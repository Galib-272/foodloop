import { apiUser, handle } from '@/lib/api';
import { platformAnalytics } from '@/lib/analytics';

export const dynamic = 'force-dynamic';
export const GET = handle(async () => {
  apiUser(['admin']);
  return platformAnalytics();
});
