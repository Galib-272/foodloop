import { Building2, Clock, MapPin, Scale } from 'lucide-react';
import { ActionButton } from '@/components/app/action-button';
import { Pill } from '@/components/app/ui';
import type { MatchResult } from '@/lib/matching';
import { fmtDateTime } from '@/lib/format';
import { GrowBar } from '@/components/motion';

const FACTORS: [keyof MatchResult['factors'], string][] = [['quantity', 'Capacity fit'], ['distance', 'Distance'], ['timing', 'Timing'], ['need', 'Need']];

export function MatchCard({ m, donationId, canSelect, unit }: { m: MatchResult; donationId: number; canSelect: boolean; unit: string }) {
  return (
    <article className="flex h-full flex-col rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{m.org.organization_name}</h3>
          <p className="flex items-center gap-1 text-xs text-muted-foreground"><Building2 className="h-3.5 w-3.5" aria-hidden="true" />{m.org.organization_type} · {m.org.area}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-bold leading-none text-primary">{m.score}<span className="text-sm font-medium text-muted-foreground">{m.score_source === 'ai' ? '%' : '/100'}</span></p>
          <p className="text-[11px] text-muted-foreground">{m.score_source === 'ai' ? 'AI success chance' : 'rule score'}</p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /><dt className="sr-only">Distance</dt><dd>{m.distance_km != null ? `~${m.distance_km} km (straight line)` : 'Distance unknown'}</dd></div>
        <div className="flex items-center gap-1.5"><Scale className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /><dt className="sr-only">Capacity</dt><dd>{m.available_capacity} kg-eq capacity left</dd></div>
        <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /><dt className="sr-only">Receiving</dt><dd>Receives {m.org.operating_hours_open}–{m.org.operating_hours_close}</dd></div>
        <div className="flex items-center gap-1.5"><dt className="text-muted-foreground">Needs</dt><dd>{m.org.required_quantity ? `~${m.org.required_quantity} kg-eq/day` : '—'}</dd></div>
      </dl>
      <div className="mt-3 grid grid-cols-4 gap-1.5" aria-label="Rule factors">
        {FACTORS.map(([k, label]) => (
          <div key={k}>
            <GrowBar percent={Math.round(m.factors[k] * 100)} />
            <p className="mt-1 text-[10px] text-muted-foreground">{label} {Math.round(m.factors[k] * 100)}%</p>
          </div>
        ))}
      </div>
      <p className="mb-3 mt-3 text-xs leading-relaxed text-muted-foreground">{m.explanation} Earliest receipt: {fmtDateTime(m.earliest_receive)}.</p>
      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
        {m.request_status ? <Pill tone={m.request_status === 'pending' ? 'blue' : m.request_status === 'offered' ? 'amber' : 'default'}>{m.request_status === 'pending' ? 'Requested' : m.request_status === 'offered' ? 'Offer sent' : m.request_status}</Pill> : <span />}
        {canSelect && !m.request_status && (
          <ActionButton endpoint={`/api/donations/${donationId}/offer`} body={{ recipient_id: m.recipient_user_id }} label="Select Recipient" success="Offer sent — waiting for the organization to accept"
            confirm={{ title: `Offer this donation to ${m.org.organization_name}?`, description: `They will be asked to accept or decline. The donation stays available to others until someone is accepted. Unit: ${unit}.`, confirmLabel: 'Send offer' }} />
        )}
      </div>
    </article>
  );
}
