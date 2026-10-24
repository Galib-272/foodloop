import Link from 'next/link';
import { AREAS } from '@/lib/areas';
import { did } from '@/lib/format';

/**
 * Schematic map of Dhaka (approximate straight-line positions). No external map tiles are loaded.
 */
export function AreaMap({ points, home }: { points: { id: number; lat: number; lng: number; label: string; urgent?: boolean }[]; home?: { lat: number; lng: number; label: string } | null }) {
  const dhaka = AREAS.filter((a) => a.lat > 23.6 && a.lat < 23.95 && a.lng > 90.3 && a.lng < 90.5);
  const all = [...dhaka, ...points.map((p) => ({ lat: p.lat, lng: p.lng })), ...(home ? [home] : [])];
  const minLat = Math.min(...all.map((a) => a.lat)) - 0.01, maxLat = Math.max(...all.map((a) => a.lat)) + 0.01;
  const minLng = Math.min(...all.map((a) => a.lng)) - 0.01, maxLng = Math.max(...all.map((a) => a.lng)) + 0.01;
  const W = 800, H = 520;
  const x = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * W;
  const y = (lat: number) => H - ((lat - minLat) / (maxLat - minLat)) * H;
  // Spread markers that share a location.
  const seen = new Map<string, number>();
  return (
    <div className="overflow-hidden rounded-xl border bg-[#f3f1ea]">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Schematic map of donation pickup areas">
        <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#e3dfd3" strokeWidth="1" /></pattern></defs>
        <rect width={W} height={H} fill="url(#grid)" />
        {dhaka.map((a) => (
          <g key={a.name}>
            <circle cx={x(a.lng)} cy={y(a.lat)} r={3} fill="#b9b3a3" />
            <text x={x(a.lng)} y={y(a.lat) + 26} fontSize="12" textAnchor="middle" fill="#8a8473">{a.name}</text>
          </g>
        ))}
        {home && (
          <g>
            <circle cx={x(home.lng)} cy={y(home.lat)} r={11} fill="#2f7fc4" stroke="#fff" strokeWidth="3" />
            <text x={x(home.lng)} y={y(home.lat) - 16} fontSize="12" fontWeight="600" textAnchor="middle" fill="#1d4f7a">{home.label}</text>
          </g>
        )}
        {points.map((p) => {
          const k = `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
          const n = seen.get(k) ?? 0;
          seen.set(k, n + 1);
          const cx = x(p.lng) + n * 16, cy = y(p.lat) - n * 4;
          return (
            <Link key={p.id} href={`/app/donations/${p.id}`} aria-label={`${p.label} (${did(p.id)})`}>
              <g className="cursor-pointer">
                <circle cx={cx} cy={cy} r={10} fill={p.urgent ? '#b42318' : '#16804a'} stroke="#fff" strokeWidth="3" />
                <title>{p.label}</title>
              </g>
            </Link>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-4 border-t bg-card px-4 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-[#16804a]" />Donation</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-[#b42318]" />Deadline within 8 h</span>
        {home && <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-[#2f7fc4]" />Your organization</span>}
        <span className="ml-auto">Schematic, approximate positions</span>
      </div>
    </div>
  );
}
