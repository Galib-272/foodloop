import { apiUser, handle } from '@/lib/api';
import { recipientAnalytics } from '@/lib/analytics';

export const dynamic = 'force-dynamic';
export const GET = handle(async () => recipientAnalytics(apiUser(['recipient']).id));
