import { apiUser, handle } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => ({ user: apiUser() }));
