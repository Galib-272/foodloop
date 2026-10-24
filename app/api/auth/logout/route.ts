import { destroySession } from '@/lib/auth';
import { handle } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const POST = handle(async () => {
  destroySession();
  return { ok: true };
});
