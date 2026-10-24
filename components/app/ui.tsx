import Link from 'next/link';
import {
  AlertTriangle, Ban, CheckCircle2, CircleDot, Clock, Hourglass, Inbox, PackageCheck, ShieldAlert, ShieldCheck, ShieldQuestion,
  Truck, XCircle, type LucideIcon,
} from 'lucide-react';
import { DONATION_STATUS_LABEL, VERIFICATION_LABEL, type DonationStatus, type Verification } from '@/lib/constants';
import { deadline } from '@/lib/format';
import { cn } from '@/lib/utils';

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-secondary">{eyebrow}</p>}
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, description, action, children, className, bodyClassName }: {
  title?: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string;
}) {
  return (
    <section className={cn('rounded-xl border bg-card', className)}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            {title && <h2 className="font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'default', href }: {
  label: string; value: React.ReactNode; hint?: React.ReactNode; icon: LucideIcon; tone?: 'default' | 'green' | 'amber' | 'red'; href?: string;
}) {
  const body = (
    <div className={cn('h-full rounded-xl border bg-card p-5 transition-shadow', href && 'hover:shadow-md')}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg',
          tone === 'green' && 'bg-accent text-primary', tone === 'amber' && 'bg-amber-100 text-amber-700',
          tone === 'red' && 'bg-red-100 text-red-700', tone === 'default' && 'bg-muted text-foreground')}>
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
  return href ? <Link href={href} className="block h-full rounded-xl">{body}</Link> : body;
}

const STATUS_STYLE: Record<DonationStatus, { cls: string; icon: LucideIcon }> = {
  available: { cls: 'bg-green-50 text-green-800 ring-green-600/20', icon: CircleDot },
  requested: { cls: 'bg-blue-50 text-blue-800 ring-blue-600/20', icon: Inbox },
  accepted: { cls: 'bg-indigo-50 text-indigo-800 ring-indigo-600/20', icon: CheckCircle2 },
  scheduled: { cls: 'bg-violet-50 text-violet-800 ring-violet-600/20', icon: Clock },
  collected: { cls: 'bg-cyan-50 text-cyan-800 ring-cyan-600/20', icon: Truck },
  delivered: { cls: 'bg-emerald-100 text-emerald-900 ring-emerald-700/25', icon: PackageCheck },
  cancelled: { cls: 'bg-gray-100 text-gray-700 ring-gray-500/20', icon: Ban },
  expired: { cls: 'bg-amber-50 text-amber-800 ring-amber-600/25', icon: Hourglass },
  rejected: { cls: 'bg-red-50 text-red-800 ring-red-600/20', icon: XCircle },
  failed: { cls: 'bg-red-50 text-red-800 ring-red-600/20', icon: AlertTriangle },
};

/** Status is always communicated with text + icon, never colour alone. */
export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status as DonationStatus] ?? { cls: 'bg-muted text-foreground ring-border', icon: CircleDot };
  const Icon = s.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', s.cls)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {DONATION_STATUS_LABEL[status as DonationStatus] ?? status}
    </span>
  );
}

export function Pill({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'green' | 'amber' | 'red' | 'blue' }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
      tone === 'default' && 'bg-muted text-foreground ring-border', tone === 'green' && 'bg-green-50 text-green-800 ring-green-600/20',
      tone === 'amber' && 'bg-amber-50 text-amber-800 ring-amber-600/25', tone === 'red' && 'bg-red-50 text-red-800 ring-red-600/20',
      tone === 'blue' && 'bg-blue-50 text-blue-800 ring-blue-600/20')}>
      {children}
    </span>
  );
}

export function VerificationBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? 'pending') as Verification;
  const map = { verified: ['green', ShieldCheck], pending: ['amber', ShieldQuestion], rejected: ['red', ShieldAlert], suspended: ['red', Ban] } as const;
  const [tone, Icon] = map[s] ?? map.pending;
  return (
    <Pill tone={tone}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {VERIFICATION_LABEL[s] ?? s}
    </Pill>
  );
}

export function DeadlineBadge({ iso, now }: { iso: string; now?: number }) {
  const d = deadline(iso, now);
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold',
      d.level === 'urgent' && 'text-red-700', d.level === 'soon' && 'text-amber-700', d.level === 'ok' && 'text-muted-foreground', d.level === 'passed' && 'text-muted-foreground line-through')}>
      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      {d.label}
    </span>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, children, action }: { icon?: LucideIcon; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary"><Icon className="h-6 w-6" aria-hidden="true" /></span>
      <h3 className="mt-4 font-semibold">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', children }: { title?: string; children?: React.ReactNode }) {
  return (
    <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
      <p className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" aria-hidden="true" />{title}</p>
      {children && <div className="mt-1 text-foreground">{children}</div>}
    </div>
  );
}

export function Notice({ tone = 'info', title, children }: { tone?: 'info' | 'warning' | 'success'; title?: string; children: React.ReactNode }) {
  return (
    <div role="note" className={cn('rounded-xl border p-4 text-sm',
      tone === 'info' && 'border-blue-200 bg-blue-50 text-blue-950', tone === 'warning' && 'border-amber-300 bg-amber-50 text-amber-950',
      tone === 'success' && 'border-green-300 bg-green-50 text-green-950')}>
      {title && <p className="font-semibold">{title}</p>}
      <div className={title ? 'mt-0.5' : ''}>{children}</div>
    </div>
  );
}

export function Table({ head, children, empty }: { head: React.ReactNode[]; children: React.ReactNode; empty?: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b bg-muted/50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <tr>{head.map((h, i) => <th key={i} scope="col" className="px-4 py-3">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
      {empty}
    </div>
  );
}
