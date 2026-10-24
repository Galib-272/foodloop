import Link from 'next/link';
import { MapPin, Snowflake, Sun, Thermometer } from 'lucide-react';
import { DeadlineBadge, StatusBadge, VerificationBadge } from '@/components/app/ui';
import { did, fmtDateTime, qty } from '@/lib/format';
import { STORAGE_LABEL, type Storage } from '@/lib/constants';
import type { Donation } from '@/lib/donations';

const STORAGE_ICON = { ambient: Sun, refrigerated: Thermometer, frozen: Snowflake } as const;

export function DonationCard({ d, footer, score, explanation, distance }: {
  d: Donation; footer?: React.ReactNode; score?: number; explanation?: string; distance?: number | null;
}) {
  const SIcon = STORAGE_ICON[d.storage_requirement as Storage] ?? Sun;
  return (
    <article className="flex h-full flex-col rounded-xl border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-secondary">{d.food_category}</p>
          <h3 className="mt-0.5 truncate text-lg font-semibold">
            <Link href={`/app/donations/${d.id}`} className="hover:underline">{d.item_name}</Link>
          </h3>
          <p className="font-mono text-xs text-muted-foreground">{did(d.id)}</p>
        </div>
        {score != null ? (
          <div className="shrink-0 text-right">
            <p className="text-2xl font-bold leading-none text-primary">{score}<span className="text-sm font-medium">%</span></p>
            <p className="text-[11px] text-muted-foreground">match chance</p>
          </div>
        ) : (
          <StatusBadge status={d.status} />
        )}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
        <div><dt className="text-xs text-muted-foreground">Quantity</dt><dd className="font-semibold">{qty(d.quantity_available, d.unit)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Pickup area</dt><dd className="flex items-center gap-1 font-medium"><MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />{d.area ?? '—'}</dd>{distance != null && <dd className="text-xs text-muted-foreground">~{distance} km away</dd>}</div>
        <div><dt className="text-xs text-muted-foreground">Safe until</dt><dd className="font-medium">{fmtDateTime(d.safe_until)}</dd><DeadlineBadge iso={d.safe_until} /></div>
        <div><dt className="text-xs text-muted-foreground">Storage</dt><dd className="flex items-center gap-1 font-medium"><SIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />{STORAGE_LABEL[d.storage_requirement as Storage]?.split(' (')[0]}</dd></div>
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Donor:</span>
        <VerificationBadge status={d.donor_verification} />
        {score != null && <StatusBadge status={d.status} />}
      </div>
      {explanation && <p className="mt-3 rounded-lg bg-accent/60 p-3 text-xs leading-relaxed text-accent-foreground">{explanation}</p>}
      <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
        {footer ?? <Link href={`/app/donations/${d.id}`} className="text-sm font-semibold text-secondary hover:underline">View Details</Link>}
      </div>
    </article>
  );
}
