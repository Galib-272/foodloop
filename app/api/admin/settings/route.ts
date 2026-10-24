import { z } from 'zod';
import { getSetting, setSetting } from '@/lib/db';
import { apiUser, handle, parseBody } from '@/lib/api';
import { audit } from '@/lib/audit';
import { CSV_MAX_BYTES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  apiUser(['admin']);
  return { csv_max_kb: Math.round(Number(getSetting('csv_max_bytes', String(CSV_MAX_BYTES))) / 1024), demo_mode: getSetting('demo_mode', '0') === '1' };
});

export const PATCH = handle(async (req) => {
  const admin = apiUser(['admin']);
  const b = await parseBody(req, z.object({ csv_max_kb: z.coerce.number().int().min(50).max(10240), demo_mode: z.boolean() }));
  const before = { csv_max_kb: Math.round(Number(getSetting('csv_max_bytes', String(CSV_MAX_BYTES))) / 1024), demo_mode: getSetting('demo_mode', '0') === '1' };
  setSetting('csv_max_bytes', String(b.csv_max_kb * 1024));
  setSetting('demo_mode', b.demo_mode ? '1' : '0');
  audit(admin.id, 'settings.update', 'settings', null, null, { before, after: b });
  return { ok: true };
});
