'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileUp, Loader2, UploadCloud, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/forms/field';
import { apiFetch } from '@/lib/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Presence } from '@/components/motion';

type Issue = { row: number; column: string; message: string; severity: 'error' | 'warning' };
type Validation = {
  columns: string[]; rows: Record<string, string>[]; issues: Issue[]; missingColumns: string[]; extraColumns?: string[];
  summary: { total: number; valid: number; errorRows: number; warningCount: number; duplicates: number };
};

const PREVIEW = 100;

export function ImportClient({ maxKb }: { maxKb: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [val, setVal] = useState<Validation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'validate' | 'import' | null>(null);
  const [drag, setDrag] = useState(false);
  const [showOnlyErrors, setShowOnlyErrors] = useState(true);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setError(null);
    setVal(null);
    if (!/\.csv$/i.test(f.name)) return setError('Only .csv files are accepted.');
    if (f.size > maxKb * 1024) return setError(`File is too large (${Math.round(f.size / 1024)} KB). The maximum is ${maxKb} KB.`);
    setFileName(f.name);
    const content = await f.text();
    setBusy('validate');
    const { data, error } = await apiFetch<Validation>('/api/forecasts/import-data', { body: { file_name: f.name, mode: 'validate', content } });
    setBusy(null);
    if (error) return setError(error.message);
    setVal(data);
    setRows(data!.rows);
  }

  async function revalidate() {
    if (!rows) return;
    setBusy('validate');
    const { data, error } = await apiFetch<Validation>('/api/forecasts/import-data', { body: { file_name: fileName, mode: 'validate', rows } });
    setBusy(null);
    if (error) return setError(error.message);
    setVal(data);
  }

  async function doImport() {
    if (!rows) return;
    setBusy('import');
    const { data, error } = await apiFetch<{ imported: number }>('/api/forecasts/import-data', { body: { file_name: fileName, mode: 'import', rows } });
    setBusy(null);
    if (error) return setError(error.message);
    toast({ title: 'Import complete', description: `${data!.imported} records imported.` });
    setVal(null);
    setRows(null);
    setFileName('');
    router.refresh();
  }

  const issuesAt = (row: number, col: string) => val?.issues.filter((i) => i.row === row && i.column === col) ?? [];
  const errorRows = new Set(val?.issues.filter((i) => i.severity === 'error').map((i) => i.row));
  const visible = (rows ?? []).map((r, i) => ({ r, n: i + 1 })).filter(({ n }) => !showOnlyErrors || !val || errorRows.size === 0 || errorRows.has(n)).slice(0, PREVIEW);
  const canImport = val && val.missingColumns.length === 0 && val.summary.errorRows === 0 && val.summary.valid > 0;

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]); }}
        className={cn('flex flex-col items-center justify-center rounded-xl border-2 border-dashed bg-card px-6 py-10 text-center transition-colors', drag && 'border-secondary bg-accent')}
      >
        <UploadCloud className="h-10 w-10 text-secondary" aria-hidden="true" />
        <p className="mt-3 font-semibold">Drop your CSV file here</p>
        <p className="text-sm text-muted-foreground">CSV only · up to {maxKb} KB · treated as data, never executed</p>
        <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" id="csv-file" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button type="button" variant="outline" className="mt-4" onClick={() => input.current?.click()} disabled={!!busy}>
          {busy === 'validate' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}Choose file
        </Button>
        {fileName && <p className="mt-2 text-xs text-muted-foreground">{fileName}</p>}
      </div>

      <FormAlert message={error} />

      <Presence show={!!val} id={val ? `${val.summary.total}-${val.summary.errorRows}-${val.summary.warningCount}` : undefined}>
      {val && (
        <section className="space-y-4" aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ['Rows', val.summary.total, 'default'],
              ['Valid rows', val.summary.valid, 'green'],
              ['Rows with errors', val.summary.errorRows, val.summary.errorRows ? 'red' : 'default'],
              ['Warnings', val.summary.warningCount, val.summary.warningCount ? 'amber' : 'default'],
            ].map(([l, n, t]) => (
              <div key={String(l)} className={cn('rounded-xl border bg-card p-4', t === 'red' && 'border-red-300', t === 'amber' && 'border-amber-300')}>
                <p className="text-sm text-muted-foreground">{l}</p>
                <p className="text-2xl font-bold">{n}</p>
              </div>
            ))}
          </div>

          {val.missingColumns.length > 0 && (
            <FormAlert message={`Missing required columns: ${val.missingColumns.join(', ')}. Download the template to see the expected format.`} />
          )}
          {val.extraColumns && val.extraColumns.length > 0 && <p className="text-xs text-muted-foreground">Ignored extra columns: {val.extraColumns.join(', ')}</p>}

          {val.missingColumns.length === 0 && (
            <div className="rounded-xl border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
                <div>
                  <h2 className="font-semibold">Data preview</h2>
                  <p className="text-xs text-muted-foreground">Edit highlighted cells to fix errors, then re-validate. Showing up to {PREVIEW} rows.</p>
                </div>
                <div className="flex items-center gap-3">
                  {errorRows.size > 0 && (
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={showOnlyErrors} onChange={(e) => setShowOnlyErrors(e.target.checked)} />Only rows with errors</label>
                  )}
                  <Button size="sm" variant="outline" onClick={revalidate} disabled={!!busy}>{busy === 'validate' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Re-validate</Button>
                </div>
              </div>
              <div className="max-h-[480px] overflow-auto">
                <table className="w-full min-w-[900px] text-xs">
                  <thead className="sticky top-0 bg-muted text-left">
                    <tr><th className="px-2 py-2">Row</th>{val.columns.map((c) => <th key={c} className="px-2 py-2 font-semibold">{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {visible.map(({ r, n }) => (
                      <tr key={n} className="border-t align-top">
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {errorRows.has(n) ? <XCircle className="inline h-3.5 w-3.5 text-destructive" aria-label="Has errors" /> : <CheckCircle2 className="inline h-3.5 w-3.5 text-green-600" aria-label="Valid" />} {n}
                        </td>
                        {val.columns.map((c) => {
                          const iss = issuesAt(n, c);
                          const err = iss.find((i) => i.severity === 'error');
                          const warn = iss.find((i) => i.severity === 'warning');
                          return (
                            <td key={c} className="px-1 py-1">
                              <input
                                aria-label={`Row ${n} ${c}`}
                                aria-invalid={!!err}
                                title={(err ?? warn)?.message}
                                value={rows?.[n - 1]?.[c] ?? ''}
                                onChange={(e) => setRows((rs) => rs && rs.map((x, i) => (i === n - 1 ? { ...x, [c]: e.target.value } : x)))}
                                className={cn('w-full min-w-[70px] rounded border bg-transparent px-1.5 py-1', err && 'border-red-400 bg-red-50', !err && warn && 'border-amber-400 bg-amber-50')}
                              />
                              {(err ?? warn) && <span className={cn('mt-0.5 block text-[10px] leading-tight', err ? 'text-destructive' : 'text-amber-700')}>{(err ?? warn)!.message}</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={doImport} disabled={!canImport || !!busy}>
              {busy === 'import' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm import ({val.summary.valid} rows)
            </Button>
            {!canImport && val.summary.errorRows > 0 && (
              <p className="flex items-center gap-1.5 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />Fix all errors before importing.</p>
            )}
            {val.summary.warningCount > 0 && canImport && <p className="text-sm text-amber-700">Warnings do not block the import.</p>}
          </div>
        </section>
      )}
      </Presence>
    </div>
  );
}
