/** Accessible confusion-matrix heat-grid: numbers are always shown, colour is only a secondary cue. */
export function ConfusionMatrix({ matrix, labels, title }: { matrix: number[][]; labels: string[]; title?: string }) {
  const rowTotals = matrix.map((r) => r.reduce((a, b) => a + b, 0));
  const max = Math.max(...matrix.flat());
  return (
    <figure>
      {title && <figcaption className="mb-2 text-sm font-medium">{title}</figcaption>}
      <div className="overflow-x-auto">
        <table className="text-sm" aria-label={title ?? 'Confusion matrix'}>
          <thead>
            <tr>
              <th className="p-1" />
              <th colSpan={labels.length} className="p-1 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Predicted</th>
            </tr>
            <tr>
              <th className="p-1 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actual</th>
              {labels.map((l) => <th key={l} scope="col" className="min-w-[88px] p-1 text-center text-xs font-semibold">{l}</th>)}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={labels[i]}>
                <th scope="row" className="whitespace-nowrap p-1 pr-3 text-left text-xs font-semibold">{labels[i]}</th>
                {row.map((v, j) => {
                  const a = max ? v / max : 0;
                  const diag = i === j;
                  return (
                    <td key={j} className="p-1">
                      <div className="flex h-16 flex-col items-center justify-center rounded-md ring-1 ring-inset ring-black/5"
                        style={{ background: diag ? `rgba(22,128,74,${0.12 + a * 0.75})` : `rgba(201,122,10,${0.06 + a * 0.6})`, color: a > 0.55 ? '#fff' : undefined }}>
                        <span className="text-base font-bold tabular-nums">{v}</span>
                        <span className="text-[10px] opacity-80">{rowTotals[i] ? Math.round((v / rowTotals[i]) * 100) : 0}%</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Green diagonal = correct predictions. % = share of that actual class (recall).</p>
    </figure>
  );
}
