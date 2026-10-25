import { ApiError, apiUser, handle } from '@/lib/api';
import { audit } from '@/lib/audit';
import { emitEvent } from '@/lib/automation';

export const dynamic = 'force-dynamic';

/** Admin: send a test event to n8n. A working setup ends with an "[n8n] n8n connection test" notification. */
export const POST = handle(async () => {
  const user = apiUser(['admin']);
  if (!process.env.N8N_WEBHOOK_URL) throw new ApiError(409, 'not_configured', 'Set N8N_WEBHOOK_URL and N8N_SHARED_SECRET first (see README → Workflow automation).');
  const r = await emitEvent('automation.test', { requested_by: user.full_name });
  audit(user.id, 'automation.test', 'automation', null, null, { ...r });
  if (!r.sent) throw new ApiError(502, 'n8n_unreachable', `n8n did not accept the event (${r.status ?? r.error}). Is n8n running and the workflow active?`);
  return { ok: true };
});
