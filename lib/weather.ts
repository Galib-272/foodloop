/**
 * Weather API pull for the leftover forecast. Open-Meteo (https://open-meteo.com) is free and needs no key.
 * The daily forecast is mapped to the four weather types the waste model was trained on (Sunny, Cloudy, Rainy, Hot).
 * Results are cached for an hour per location and day. If the API cannot be reached, the forecast just uses "typical".
 */

export type WeatherType = 'Sunny' | 'Cloudy' | 'Rainy' | 'Hot';
export type DailyWeather = {
  date: string;
  weather: WeatherType;
  temperature_max: number | null;
  precipitation_mm: number | null;
  rain_chance: number | null;
  code: number | null;
  description: string;
  source: 'open-meteo';
};

const DHAKA = { latitude: 23.8103, longitude: 90.4125 };
const cache = new Map<string, { at: number; days: DailyWeather[] }>();
const HOUR = 3600_000;

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const CLOUD_CODES = new Set([2, 3, 45, 48]);
const CODE_TEXT: Record<number, string> = {
  0: 'clear sky', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'fog', 51: 'light drizzle', 53: 'drizzle',
  55: 'heavy drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain', 80: 'rain showers', 81: 'rain showers', 82: 'heavy showers',
  95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'thunderstorm with hail',
};

/** Map one Open-Meteo day to the model's weather type. Order: Rainy > Hot > Cloudy > Sunny. */
export function toWeatherType(code: number | null, tMax: number | null, rainMm: number | null): WeatherType {
  if ((rainMm ?? 0) >= 2 || (code !== null && RAIN_CODES.has(code))) return 'Rainy';
  if ((tMax ?? 0) >= 33) return 'Hot';
  if (code !== null && CLOUD_CODES.has(code)) return 'Cloudy';
  return 'Sunny';
}

type OpenMeteoDaily = {
  daily?: { time: string[]; weather_code: (number | null)[]; temperature_2m_max: (number | null)[]; precipitation_sum: (number | null)[];
    precipitation_probability_max?: (number | null)[] };
};

export function parseOpenMeteo(j: OpenMeteoDaily): DailyWeather[] {
  const d = j.daily;
  if (!d?.time) return [];
  return d.time.map((date, i) => {
    const code = d.weather_code[i] ?? null;
    const t = d.temperature_2m_max[i] ?? null;
    const rain = d.precipitation_sum[i] ?? null;
    const chance = d.precipitation_probability_max?.[i] ?? null;
    const weather = toWeatherType(code, t, rain);
    const bits = [code !== null ? CODE_TEXT[code] ?? `code ${code}` : null, t !== null ? `max ${Math.round(t)}°C` : null,
      rain !== null ? `${rain.toFixed(1)} mm rain` : null, chance !== null ? `${chance}% chance of rain` : null].filter(Boolean);
    return { date, weather, temperature_max: t, precipitation_mm: rain, rain_chance: chance, code, description: bits.join(', '), source: 'open-meteo' };
  });
}

export async function dailyWeather(lat?: number | null, lon?: number | null): Promise<DailyWeather[]> {
  const latitude = Number.isFinite(lat) ? Number(lat) : DHAKA.latitude;
  const longitude = Number.isFinite(lon) ? Number(lon) : DHAKA.longitude;
  const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < HOUR) return hit.days;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    '&daily=weather_code,temperature_2m_max,precipitation_sum,precipitation_probability_max&timezone=Asia%2FDhaka&forecast_days=16';
  const r = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'FoodLoop forecast' } });
  if (!r.ok) throw new Error(`Open-Meteo answered ${r.status}`);
  const days = parseOpenMeteo((await r.json()) as OpenMeteoDaily);
  cache.set(key, { at: Date.now(), days });
  return days;
}

export async function weatherFor(date: string, lat?: number | null, lon?: number | null): Promise<DailyWeather | null> {
  try {
    return (await dailyWeather(lat, lon)).find((d) => d.date === date) ?? null;
  } catch {
    return null;
  }
}
