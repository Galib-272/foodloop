import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, PageHeader, Pill, Table } from '@/components/app/ui';
import { ImportClient } from './import-client';
import { requireUser } from '@/lib/auth';
import { getDb, getSetting } from '@/lib/db';
import { CSV_MAX_BYTES } from '@/lib/constants';
import { HISTORY_COLUMNS } from '@/lib/csv';
import { fmtDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'CSV Data Import — FoodSphere AI' };

const DESCRIPTIONS: Record<string, string> = {
  date: 'YYYY-MM-DD (or DD/MM/YYYY)', food_category: 'Prepared Food, Bakery, Fruits, Vegetables, Dairy or Meat',
  purchase_quantity: 'Units bought / prepared that day (number > 0)', units_sold: 'Units sold, not more than purchased', waste_quantity: 'Optional, units thrown away',
  shelf_life_days: 'Optional, number of days', storage_temperature: 'Optional, °C', promotion: 'Optional, Yes/No or 1/0', weather: 'Optional: Sunny, Cloudy, Rainy or Hot',
};

export default function ImportPage() {
  const user = requireUser(['donor']);
  const maxKb = Math.round(Number(getSetting('csv_max_bytes', String(CSV_MAX_BYTES))) / 1024);
  const imports = getDb().prepare('SELECT * FROM csv_imports WHERE user_id = ? ORDER BY created_at DESC LIMIT 15').all(user.id);
  return (
    <>
      <PageHeader title="CSV Data Import" description="Import daily sales and preparation history. It powers your surplus forecasts and waste analytics."
        actions={<Button asChild variant="outline"><a href="/api/forecasts/template" download><Download className="mr-2 h-4 w-4" />Download CSV template</a></Button>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <ImportClient maxKb={maxKb} />
        <Card title="Expected columns" description="One row per item per day.">
          <dl className="space-y-2.5 text-sm">
            {HISTORY_COLUMNS.map((c) => (
              <div key={c}><dt className="font-mono text-xs font-semibold">{c}</dt><dd className="text-xs text-muted-foreground">{DESCRIPTIONS[c]}</dd></div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">Rows for a date and item you already imported replace the earlier record.</p>
        </Card>
      </div>
      <div className="mt-8">
        <h2 className="mb-3 font-semibold">Import history</h2>
        <Table head={['File', 'Date', 'Rows', 'Errors', 'Status']}>
          {imports.map((i) => (
            <tr key={i.id}>
              <td className="px-4 py-2.5 font-medium">{i.file_name}</td>
              <td className="px-4 py-2.5">{fmtDateTime(String(i.created_at))}</td>
              <td className="px-4 py-2.5">{i.row_count}</td>
              <td className="px-4 py-2.5">{i.error_count}</td>
              <td className="px-4 py-2.5"><Pill tone={i.import_status === 'imported' ? 'green' : 'red'}>{i.import_status === 'imported' ? 'Imported' : 'Rejected'}</Pill></td>
            </tr>
          ))}
        </Table>
      </div>
    </>
  );
}
