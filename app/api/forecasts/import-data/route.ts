import { z } from 'zod';
import { getDb, getSetting, nowIso, tx } from '@/lib/db';
import { apiUser, badRequest, handle, parseBody, rateLimit } from '@/lib/api';
import { tableFromCsv, validateHistory, HISTORY_COLUMNS, REQUIRED_COLUMNS } from '@/lib/csv';
import { getOrgByUser } from '@/lib/orgs';
import { MODEL_BUSINESS_TYPE } from '@/lib/constants';
import { CSV_MAX_BYTES, CSV_MAX_ROWS } from '@/lib/constants';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const schema = z.object({
  file_name: z.string().trim().min(1).max(200).regex(/\.csv$/i, 'Only .csv files are accepted.'),
  mode: z.enum(['validate', 'import']),
  content: z.string().optional(),
  rows: z.array(z.record(z.string().max(300))).max(CSV_MAX_ROWS).optional(),
});

export const POST = handle(async (req) => {
  const user = apiUser(['donor']);
  rateLimit(req, 'csv', 30, 60_000);
  const maxBytes = Number(getSetting('csv_max_bytes', String(CSV_MAX_BYTES)));
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > maxBytes * 2 + 50_000) throw badRequest(`File is too large. The maximum size is ${Math.round(maxBytes / 1024)} KB.`);
  const body = await parseBody(req, schema);

  let table: Record<string, string>[];
  let header: string[];
  if (body.rows) {
    table = body.rows.map((r) => Object.fromEntries(HISTORY_COLUMNS.map((c) => [c, String(r[c] ?? '').trim()])));
    header = [...HISTORY_COLUMNS];
  } else {
    if (!body.content) throw badRequest('The file is empty.');
    if (Buffer.byteLength(body.content, 'utf8') > maxBytes) throw badRequest(`File is too large. The maximum size is ${Math.round(maxBytes / 1024)} KB.`);
    if (/\u0000/.test(body.content)) throw badRequest('This does not look like a text CSV file.');
    try {
      ({ header, table } = tableFromCsv(body.content, CSV_MAX_ROWS));
    } catch (e) {
      throw badRequest(e instanceof Error ? e.message : 'Could not read the CSV file.');
    }
  }
  if (!table.length) throw badRequest('The file has a header but no data rows.');
  const missingColumns = REQUIRED_COLUMNS.filter((c) => !header.includes(c));

  const existing = new Set(
    getDb().prepare('SELECT date, food_category FROM sales_history WHERE donor_id = ?').all(user.id).map((r) => `${r.date}|${r.food_category}`)
  );
  const result = missingColumns.length
    ? { columns: [...HISTORY_COLUMNS], rows: table.slice(0, 200), records: [], issues: [], missingColumns,
        summary: { total: table.length, valid: 0, errorRows: table.length, warningCount: 0, duplicates: 0 } }
    : { ...validateHistory(table, existing), missingColumns };

  const report = { missingColumns, summary: result.summary, issues: result.issues.slice(0, 500) };

  if (body.mode === 'validate') {
    const { records: _r, ...rest } = result;
    void _r;
    return { ...rest, extraColumns: header.filter((h) => !(HISTORY_COLUMNS as readonly string[]).includes(h)) };
  }

  // Import: refuse if any errors remain — the user must correct them first.
  if (missingColumns.length || result.summary.errorRows > 0) {
    getDb().prepare(`INSERT INTO csv_imports (user_id, file_name, import_status, row_count, error_count, validation_report, created_at) VALUES (?, ?, 'rejected', ?, ?, ?, ?)`)
      .run(user.id, body.file_name, table.length, result.summary.errorRows, JSON.stringify(report), nowIso());
    throw badRequest('Please correct all errors before importing.');
  }
  const org = getOrgByUser(user.id);
  const businessType = MODEL_BUSINESS_TYPE[org?.organization_type ?? 'Restaurant'] ?? 'Restaurant';
  const importId = tx((db) => {
    const id = Number(db.prepare(`INSERT INTO csv_imports (user_id, file_name, import_status, row_count, error_count, validation_report, created_at) VALUES (?, ?, 'imported', ?, 0, ?, ?)`)
      .run(user.id, body.file_name, table.length, JSON.stringify(report), nowIso()).lastInsertRowid);
    const up = db.prepare(
      `INSERT INTO sales_history (donor_id, import_id, date, business_type, food_category, purchase_quantity, units_sold, waste_quantity, shelf_life_days, storage_temperature, promotion, weather)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(donor_id, date, food_category) DO UPDATE SET import_id = excluded.import_id, business_type = excluded.business_type,
         purchase_quantity = excluded.purchase_quantity, units_sold = excluded.units_sold, waste_quantity = excluded.waste_quantity,
         shelf_life_days = excluded.shelf_life_days, storage_temperature = excluded.storage_temperature, promotion = excluded.promotion, weather = excluded.weather`
    );
    for (const r of result.records) {
      if (!r) continue;
      up.run(user.id, id, r.date, businessType, r.food_category, r.purchase_quantity, r.units_sold, r.waste_quantity, r.shelf_life_days, r.storage_temperature, r.promotion, r.weather);
    }
    return id;
  });
  audit(user.id, 'csv.import', 'csv_import', importId, null, { rows: table.length, file: body.file_name });
  return { ok: true, import_id: importId, imported: result.summary.valid };
});

export const GET = handle(async () => {
  const user = apiUser(['donor']);
  return {
    imports: getDb().prepare('SELECT id, file_name, import_status, row_count, error_count, created_at FROM csv_imports WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').all(user.id),
  };
});
