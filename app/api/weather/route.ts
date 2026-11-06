import { ApiError, apiUser, handle } from '@/lib/api';
import { getOrgByUser } from '@/lib/orgs';
import { weatherFor } from '@/lib/weather';

export const dynamic = 'force-dynamic';

/** GET /api/weather?date=YYYY-MM-DD -> the day's forecast for the donor's location (Open-Meteo), mapped to Sunny/Cloudy/Rainy/Hot. */
export const GET = handle(async (req) => {
  const user = apiUser(['donor', 'admin']);
  const date = new URL(req.url).searchParams.get('date') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError(400, 'bad_request', 'Use date=YYYY-MM-DD.');
  const org = getOrgByUser(user.id);
  const day = await weatherFor(date, org?.latitude, org?.longitude);
  return { ok: !!day, day, location: org?.latitude != null ? org.area : 'Dhaka' };
});
