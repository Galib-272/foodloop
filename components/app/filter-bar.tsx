import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { selectClass } from '@/components/forms/field';

export type FilterSelect = { name: string; label: string; options: { value: string; label: string }[]; value?: string };

/** Plain GET form: works without JavaScript and keeps filters in the URL. */
export function FilterBar({ q, selects = [], placeholder = 'Search…', children }: { q?: string; selects?: FilterSelect[]; placeholder?: string; children?: React.ReactNode }) {
  return (
    <form method="get" className="mb-5 flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center" role="search">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <label htmlFor="q" className="sr-only">Search</label>
        <input id="q" name="q" defaultValue={q} placeholder={placeholder}
          className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>
      {selects.map((s) => (
        <div key={s.name} className="sm:w-48">
          <label htmlFor={`f-${s.name}`} className="sr-only">{s.label}</label>
          <select id={`f-${s.name}`} name={s.name} defaultValue={s.value ?? ''} className={selectClass}>
            <option value="">{s.label}: All</option>
            {s.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      ))}
      {children}
      <Button type="submit" variant="secondary">Apply</Button>
    </form>
  );
}
