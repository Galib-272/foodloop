import { apiUser, handle } from '@/lib/api';
import { evaluatedForecasts, leftoverSeries } from '@/lib/forecast';
import { FOOD_CATEGORIES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => {
  const user = apiUser(['donor']);
  const u = new URL(req.url);
  const cat = u.searchParams.get('category') ?? 'all';
  const category = cat === 'all' || (FOOD_CATEGORIES as readonly string[]).includes(cat) ? cat : 'all';
  const days = Math.min(180, Math.max(7, Number(u.searchParams.get('days') ?? 30) || 30));
  const s = leftoverSeries(user.id, category, days);
  const evaluated = evaluatedForecasts(user.id, 300).filter((f) => category === 'all' || f.food_category === category);
  return { ...s, evaluated: evaluated.slice(0, 20) };
});
