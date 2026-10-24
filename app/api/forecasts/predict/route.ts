import { z } from 'zod';
import { apiUser, handle, parseBody, rateLimit } from '@/lib/api';
import { runForecast } from '@/lib/forecast';
import { FOOD_CATEGORIES, WEATHER } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const perCategory = z.record(z.coerce.number().min(0).max(100000)).optional();
const schema = z.object({
  category: z.union([z.literal('all'), z.enum(FOOD_CATEGORIES)]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.'),
  weather: z.enum(WEATHER).optional().nullable(),
  promotion: z.boolean().optional(),
  purchase: perCategory,
  shelf_life: perCategory,
  storage_temperature: z.record(z.coerce.number().min(-40).max(60)).optional(),
});

export const POST = handle(async (req) => {
  const user = apiUser(['donor']);
  rateLimit(req, 'predict', 60, 60_000);
  const b = await parseBody(req, schema);
  return runForecast(user.id, { ...b, weather: b.weather ?? null });
});
