import { z } from 'zod';
import { apiUser, handle, parseBody, rateLimit } from '@/lib/api';
import { extractDonation } from '@/lib/extract';

export const dynamic = 'force-dynamic';

/** POST /api/donations/extract { text } -> suggested donation-form fields (AI extraction; nothing is saved). */
export const POST = handle(async (req) => {
  apiUser(['donor']);
  rateLimit(req, 'extract', 20, 60_000);
  const { text } = await parseBody(req, z.object({ text: z.string().trim().min(5, 'Describe the food in a few words.').max(500) }));
  return extractDonation(text);
});
