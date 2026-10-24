export function MetricDefinitions() {
  return (
    <details className="rounded-xl border bg-card p-5 text-sm">
      <summary className="cursor-pointer font-semibold">How these metrics are defined</summary>
      <dl className="mt-3 space-y-2 text-muted-foreground">
        <div><dt className="inline font-medium text-foreground">Food rescued / delivered: </dt><dd className="inline">quantity confirmed as delivered by the recipient — not merely published or accepted.</dd></div>
        <div><dt className="inline font-medium text-foreground">Completed donations: </dt><dd className="inline">donations whose delivery has been confirmed.</dd></div>
        <div><dt className="inline font-medium text-foreground">Fulfillment rate: </dt><dd className="inline">delivered ÷ accepted requests that reached a final outcome (delivered, failed, cancelled or expired). Collections still in progress are excluded from the denominator.</dd></div>
        <div><dt className="inline font-medium text-foreground">Recorded food waste: </dt><dd className="inline">quantity you reported as wasted in imported history and inventory.</dd></div>
        <div><dt className="inline font-medium text-foreground">Units: </dt><dd className="inline">kilograms, liters and portions are reported separately and never added together. Charts show kilograms.</dd></div>
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">We do not claim that all donated food would otherwise have been wasted; no “waste avoided” estimate is shown until a defensible methodology is available.</p>
    </details>
  );
}
