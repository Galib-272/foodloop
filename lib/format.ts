// Client- and server-safe formatting helpers. All times are shown in Dhaka time.
const TZ = 'Asia/Dhaka';

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = iso.length === 10 ? new Date(iso + 'T00:00:00Z') : new Date(iso);
  return d.toLocaleDateString('en-GB', { timeZone: iso.length === 10 ? 'UTC' : TZ, day: 'numeric', month: 'short', year: 'numeric' });
}

export function relTime(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return '—';
  const diff = Date.parse(iso) - now;
  const abs = Math.abs(diff);
  const m = Math.round(abs / 60000);
  const h = Math.round(abs / 3600000);
  const d = Math.round(abs / 86400000);
  const s = m < 60 ? `${m} min` : h < 48 ? `${h} h` : `${d} days`;
  return diff >= 0 ? `in ${s}` : `${s} ago`;
}

/** Remaining time until a safe-use deadline, plus an urgency level. */
export function deadline(iso: string, now = Date.now()) {
  const ms = Date.parse(iso) - now;
  if (ms <= 0) return { label: 'Deadline passed', level: 'passed' as const };
  const h = ms / 3600000;
  const mins = Math.floor(ms / 60000);
  const label = h < 1 ? `${Math.max(1, mins)} min left` : h < 48 ? `${Math.floor(mins / 60)} h ${mins % 60} min left` : `${Math.round(h / 24)} days left`;
  return { label, level: h < 2 ? ('urgent' as const) : h < 8 ? ('soon' as const) : ('ok' as const) };
}

export const qty = (q: number | null | undefined, unit: string) =>
  q == null ? '—' : `${Math.round(Number(q) * 10) / 10} ${unit === 'liters' ? 'L' : unit}`;

export const did = (id: number) => `D-${String(id).padStart(4, '0')}`;

export const toLocalInput = (iso: string | Date) => {
  // value for <input type="datetime-local"> in Dhaka time
  const d = new Date(typeof iso === 'string' ? iso : iso.toISOString());
  const local = new Date(d.getTime() + 6 * 3600_000);
  return local.toISOString().slice(0, 16);
};

export const fromLocalInput = (v: string) => (v ? new Date(v + ':00+06:00').toISOString() : '');
