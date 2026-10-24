import { apiUser, handle } from '@/lib/api';
import { donorAnalytics } from '@/lib/analytics';

export const dynamic = 'force-dynamic';
export const GET = handle(async () => donorAnalytics(apiUser(['donor']).id));
