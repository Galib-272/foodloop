import { getDb } from '@/lib/db';
import { apiUser, handle, idParam, notFound } from '@/lib/api';
import { offerToRecipient } from '@/lib/donations';

export const dynamic = 'force-dynamic';

// Select a recommended recipient (match id) — sends them an offer to accept or decline.
export const POST = handle<{ params: { id: string } }>(async (_req, { params }) => {
  const user = apiUser(['donor']);
  const m = getDb().prepare('SELECT donation_id, recipient_id FROM donation_matches WHERE id = ?').get(idParam(params.id));
  if (!m) throw notFound('Match not found.');
  return offerToRecipient(user, Number(m.donation_id), Number(m.recipient_id));
});
