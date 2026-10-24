import path from 'path';
import fs from 'fs';
import { seedDatabase } from './seed';

/*
 * Local: SQLite via Node's built-in `node:sqlite` module (Node 22.5+), file in ./data.
 * Production: Turso (hosted SQLite) when TURSO_DATABASE_URL / TURSO_AUTH_TOKEN are set.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export interface Statement {
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get(...params: unknown[]): Row | undefined;
  all(...params: unknown[]): Row[];
}

export interface Database {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  close(): void;
}

const SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('donor','recipient','volunteer','admin')),
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active','suspended')),
  phone TEXT,
  email_verified_at TEXT,
  onboarded INTEGER NOT NULL DEFAULT 0,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS organizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('donor','recipient')),
  organization_name TEXT NOT NULL,
  organization_type TEXT NOT NULL,
  address TEXT NOT NULL,
  area TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  phone TEXT,
  contact_person TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending','verified','rejected','suspended')),
  verification_details TEXT,
  verification_note TEXT,
  accepted_categories TEXT NOT NULL DEFAULT '[]',
  storage_capabilities TEXT NOT NULL DEFAULT '["ambient"]',
  receiving_capacity REAL NOT NULL DEFAULT 0,
  receiving_capacity_unit TEXT NOT NULL DEFAULT 'kg',
  required_quantity REAL NOT NULL DEFAULT 0,
  operating_hours_open TEXT NOT NULL DEFAULT '09:00',
  operating_hours_close TEXT NOT NULL DEFAULT '21:00',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_org_kind_status ON organizations(kind, verification_status);

CREATE TABLE IF NOT EXISTS inventory_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  donor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  food_category TEXT NOT NULL,
  quantity REAL NOT NULL CHECK (quantity >= 0),
  unit TEXT NOT NULL,
  recorded_date TEXT NOT NULL,
  safe_until TEXT,
  shelf_life_days REAL,
  storage_requirement TEXT NOT NULL DEFAULT 'ambient',
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'in_stock'
    CHECK (status IN ('in_stock','sold','wasted','donation','archived')),
  wasted_quantity REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_inv_donor ON inventory_records(donor_id, status);

-- Daily history per food category (same structure as the Kaggle dataset; imported from CSV)
CREATE TABLE IF NOT EXISTS sales_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  donor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  import_id INTEGER REFERENCES csv_imports(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  business_type TEXT NOT NULL,
  food_category TEXT NOT NULL,
  purchase_quantity REAL NOT NULL,
  units_sold REAL NOT NULL,
  waste_quantity REAL NOT NULL DEFAULT 0,
  shelf_life_days REAL,
  storage_temperature REAL,
  promotion INTEGER NOT NULL DEFAULT 0,
  weather TEXT,
  UNIQUE (donor_id, date, food_category)
);
CREATE INDEX IF NOT EXISTS idx_hist_donor_cat ON sales_history(donor_id, food_category, date);

CREATE TABLE IF NOT EXISTS csv_imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  import_status TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  validation_report TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS model_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT NOT NULL UNIQUE,
  algorithm TEXT NOT NULL,
  target_type TEXT NOT NULL,
  trained_at TEXT NOT NULL,
  metrics TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  registered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS forecast_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  donor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL DEFAULT 'surplus',
  food_category TEXT,
  forecast_quantity REAL,
  lower_bound REAL,
  upper_bound REAL,
  unit TEXT,
  forecast_period TEXT,
  forecast_date TEXT,
  model_version TEXT,
  prediction_timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  input_reference TEXT,
  validation_status TEXT NOT NULL DEFAULT 'valid',
  error TEXT,
  evaluation_or_uncertainty_metadata TEXT
);
CREATE INDEX IF NOT EXISTS idx_fc_donor ON forecast_records(donor_id, prediction_timestamp);

CREATE TABLE IF NOT EXISTS donations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  donor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  food_category TEXT NOT NULL,
  description TEXT,
  quantity_available REAL NOT NULL CHECK (quantity_available > 0),
  unit TEXT NOT NULL,
  prepared_at TEXT,
  available_from TEXT NOT NULL,
  safe_until TEXT NOT NULL,
  storage_requirement TEXT NOT NULL,
  pickup_address TEXT NOT NULL,
  area TEXT,
  latitude REAL,
  longitude REAL,
  packaging TEXT,
  allergens TEXT,
  handling_instructions TEXT,
  contact_method TEXT,
  notes TEXT,
  forecast_id INTEGER REFERENCES forecast_records(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'available',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_don_status ON donations(status, safe_until);
CREATE INDEX IF NOT EXISTS idx_don_donor ON donations(donor_id);

CREATE TABLE IF NOT EXISTS donation_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  donation_id INTEGER NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_user_id INTEGER REFERENCES users(id),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_hist_donation ON donation_status_history(donation_id);

CREATE TABLE IF NOT EXISTS donation_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  donation_id INTEGER NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_quantity REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  request_time TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  decision_time TEXT,
  notes TEXT,
  UNIQUE (donation_id, recipient_id)
);
CREATE INDEX IF NOT EXISTS idx_req_recipient ON donation_requests(recipient_id, status);

CREATE TABLE IF NOT EXISTS donation_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  donation_id INTEGER NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  compatibility_score REAL NOT NULL,
  explanation TEXT NOT NULL,
  distance_estimate REAL,
  status TEXT NOT NULL DEFAULT 'suggested',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (donation_id, recipient_id)
);

CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  donation_id INTEGER NOT NULL UNIQUE REFERENCES donations(id) ON DELETE CASCADE,
  request_id INTEGER NOT NULL REFERENCES donation_requests(id) ON DELETE CASCADE,
  assigned_volunteer_id INTEGER REFERENCES users(id),
  needs_volunteer INTEGER NOT NULL DEFAULT 0,
  task_status TEXT NOT NULL DEFAULT 'unassigned',
  scheduled_pickup_time TEXT,
  actual_pickup_time TEXT,
  actual_delivery_time TEXT,
  quantity_collected REAL,
  quantity_delivered REAL,
  received_as_expected INTEGER,
  discrepancy TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  failure_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS deadline_alerts (
  donation_id INTEGER PRIMARY KEY REFERENCES donations(id) ON DELETE CASCADE,
  sent_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  related_entity_type TEXT,
  related_entity_id INTEGER,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  donation_id INTEGER REFERENCES donations(id) ON DELETE CASCADE,
  reporter_id INTEGER NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  resolution TEXT,
  resolved_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  reason TEXT,
  relevant_metadata TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

// v2 = Kaggle-aligned schema. A new file is used so an older database is never mixed with the new schema.
const DB_FILE = process.env.FOODSPHERE_DB_FILE || 'foodsphere-v2.db';
const g = globalThis as unknown as { __foodsphereDbV2?: Database };

/** Local development: Node's built-in SQLite, one file in ./data. */
function openLocal(): Database {
  // eval('require') is the real Node require; webpack leaves it untouched.
  // eslint-disable-next-line no-eval
  const nodeRequire = eval('require') as NodeRequire;
  const { DatabaseSync } = nodeRequire('node:sqlite') as {
    DatabaseSync: new (file: string) => Database;
  };
  const dir = path.join(process.cwd(), 'data');
  fs.mkdirSync(dir, { recursive: true });
  return new DatabaseSync(path.join(dir, DB_FILE));
}

/**
 * Production (Vercel): Turso, a hosted SQLite-compatible database, via the `libsql` package.
 * It has the same synchronous prepare/get/all/run API, so the rest of the app is unchanged.
 */
function openRemote(url: string, authToken?: string): Database {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Libsql = require('libsql') as new (url: string, opts?: { authToken?: string }) => Database;
  const raw = new Libsql(url, authToken ? { authToken } : {});
  // Make remote rows look exactly like local SQLite rows:
  // libsql adds a `_metadata` field, and the server returns columns named after SQL keywords in capitals
  // (e.g. `action` -> `ACTION`). All our columns are lowercase, so all-capital keys are lowercased.
  const clean = (r: Row | undefined) => {
    if (!r || typeof r !== 'object') return r;
    delete r._metadata;
    for (const k of Object.keys(r)) {
      if (/[A-Z]/.test(k) && k === k.toUpperCase() && !(k.toLowerCase() in r)) {
        r[k.toLowerCase()] = r[k];
        delete r[k];
      }
    }
    return r;
  };
  return {
    exec: (sql: string) => raw.exec(sql),
    close: () => raw.close(),
    prepare(sql: string): Statement {
      const st = raw.prepare(sql);
      return {
        run: (...p: unknown[]) => st.run(...p),
        get: (...p: unknown[]) => clean(st.get(...p)),
        all: (...p: unknown[]) => st.all(...p).map((r) => clean(r) as Row),
      };
    },
  };
}

function isSeeded(db: Database): boolean {
  try {
    return !!db.prepare(`SELECT value FROM settings WHERE key = 'seeded'`).get();
  } catch {
    return false; // tables do not exist yet
  }
}

function open(): Database {
  const remoteUrl = process.env.TURSO_DATABASE_URL;
  const db = remoteUrl ? openRemote(remoteUrl, process.env.TURSO_AUTH_TOKEN) : openLocal();
  if (remoteUrl && isSeeded(db)) return db; // remote: skip schema checks on every cold start (saves round trips)
  db.exec(remoteUrl ? SCHEMA.replace('PRAGMA journal_mode = WAL;', '') : SCHEMA);
  if (!isSeeded(db)) {
    // One transaction: an interrupted seed leaves no half-filled data behind.
    db.exec('BEGIN');
    try {
      seedDatabase(db);
      db.prepare(`INSERT OR REPLACE INTO settings(key, value) VALUES ('seeded', '1')`).run();
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  return db;
}

export function getDb(): Database {
  if (!g.__foodsphereDbV2) g.__foodsphereDbV2 = open();
  return g.__foodsphereDbV2;
}

/** Run fn inside a transaction; rolls back on error. */
export function tx<T>(fn: (db: Database) => T): T {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn(db);
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function getSetting(key: string, fallback: string): string {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? String(row.value) : fallback;
}

export function setSetting(key: string, value: string) {
  getDb()
    .prepare('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value);
}
