import { z } from 'zod';
import { apiUser, handle, parseBody, rateLimit } from '@/lib/api';
import { ask } from '@/lib/rag/search';

export const dynamic = 'force-dynamic';

/** POST /api/assistant { question } -> answer with cited sources (RAG over the FoodSphere knowledge base). */
export const POST = handle(async (req) => {
  apiUser();
  rateLimit(req, 'assistant', 30, 60_000);
  const { question } = await parseBody(req, z.object({ question: z.string().trim().min(3, 'Ask a slightly longer question.').max(500) }));
  return ask(question);
});
