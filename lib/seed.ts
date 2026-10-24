import type { Database } from './db';
import { hashPassword } from './password';
import fs from 'fs';
import path from 'path';
import { parseCsv } from './csv';

/*
 * Seeds clearly-marked DEMO data (users.is_demo = 1) so every dashboard can be
 * explored immediately. Landing-page statistics label these figures as demo data.
 */

export const DEMO_PASSWORD = 'Demo@1234';

const iso = (d: Date) => d.toISOString();
const daysAgo = (n: number, hour = 12) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(hour - 6, 0, 0, 0); // hour given in Dhaka time (UTC+6)
  return d;
};
const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600_000);

export function seedDatabase(db: Database) {
  const pw = hashPassword(DEMO_PASSWORD);
  const created = iso(daysAgo(160));

  const insUser = db.prepare(
    `INSERT INTO users (full_name, email, password_hash, role, phone, email_verified_at, onboarded, is_demo, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`
  );
  const user = (name: string, email: string, role: string, phone: string, createdAt = created) =>
    Number(insUser.run(name, email, pw, role, phone, createdAt, createdAt, createdAt).lastInsertRowid);

  const admin = user('Platform Admin', 'admin@foodsphere.test', 'admin', '+8801700000001');
  const donor1 = user('Rahim Ahmed', 'donor@foodsphere.test', 'donor', '+8801711000001');
  const donor2 = user('Nusrat Jahan', 'donor2@foodsphere.test', 'donor', '+8801711000002', iso(daysAgo(120)));
  const rec1 = user('Karim Hossain', 'recipient@foodsphere.test', 'recipient', '+8801811000001');
  const rec2 = user('Fatema Begum', 'recipient2@foodsphere.test', 'recipient', '+8801811000002', iso(daysAgo(140)));
  const rec3 = user('Arif Rahman', 'recipient3@foodsphere.test', 'recipient', '+8801811000003', iso(daysAgo(100)));
  const rec4 = user('Sharmin Akter', 'recipient4@foodsphere.test', 'recipient', '+8801811000004', iso(daysAgo(3)));
  const vol = user('Tanvir Islam', 'volunteer@foodsphere.test', 'volunteer', '+8801911000001', iso(daysAgo(90)));

  const insOrg = db.prepare(
    `INSERT INTO organizations (user_id, kind, organization_name, organization_type, address, area, latitude, longitude, phone,
      contact_person, verification_status, verification_details, accepted_categories, storage_capabilities,
      receiving_capacity, required_quantity, operating_hours_open, operating_hours_close, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const org = (
    uid: number, kind: string, name: string, type: string, address: string, area: string,
    lat: number, lng: number, contact: string, status: string, cats: string[], storage: string[],
    capacity: number, required: number, open: string, close: string
  ) =>
    insOrg.run(uid, kind, name, type, address, area, lat, lng, '+88017' + String(uid).padStart(8, '0'),
      contact, status, 'Trade licence / registration number provided (demo)', JSON.stringify(cats),
      JSON.stringify(storage), capacity, required, open, close, created, created);

  const ALL = ['Prepared Food', 'Bakery', 'Fruits', 'Vegetables', 'Dairy', 'Meat'];
  org(donor1, 'donor', 'Dhanmondi Kitchen & Bakery', 'Restaurant', 'House 27, Road 7, Dhanmondi', 'Dhanmondi', 23.7461, 90.3742, 'Rahim Ahmed', 'verified', [], ['ambient', 'refrigerated'], 0, 0, '10:00', '23:00');
  org(donor2, 'donor', 'Gulshan Fresh Market', 'Food Market', 'Gulshan Avenue, Gulshan-1', 'Gulshan', 23.7808, 90.4167, 'Nusrat Jahan', 'verified', [], ['ambient', 'refrigerated', 'frozen'], 0, 0, '07:00', '22:00');
  org(rec1, 'recipient', 'Mirpur Community Kitchen', 'Community Kitchen', 'Section 10, Mirpur', 'Mirpur', 23.8069, 90.3687, 'Karim Hossain', 'verified', ['Prepared Food', 'Bakery', 'Vegetables', 'Fruits'], ['ambient', 'refrigerated'], 80, 50, '08:00', '22:00');
  org(rec2, 'recipient', 'Hope Shelter Mohammadpur', 'Shelter', 'Tajmahal Road, Mohammadpur', 'Mohammadpur', 23.7662, 90.3589, 'Fatema Begum', 'verified', ['Prepared Food', 'Bakery', 'Dairy', 'Fruits'], ['ambient', 'refrigerated'], 40, 25, '07:00', '21:00');
  org(rec3, 'recipient', 'Dhaka Food Bank — Tejgaon', 'Food Bank', 'Tejgaon Industrial Area', 'Tejgaon', 23.7639, 90.3930, 'Arif Rahman', 'verified', ALL, ['ambient', 'refrigerated', 'frozen'], 300, 120, '09:00', '18:00');
  org(rec4, 'recipient', "Uttara Children's Home", 'Orphanage', 'Sector 7, Uttara', 'Uttara', 23.8759, 90.3795, 'Sharmin Akter', 'pending', ['Prepared Food', 'Bakery', 'Dairy'], ['ambient', 'refrigerated'], 30, 20, '08:00', '20:00');

  // --- History for the demo donors: real rows from the Kaggle food-waste dataset ---
  // Restaurant rows for the restaurant, Supermarket rows for the market (one row per day and category),
  // with dates shifted so the most recent record is yesterday.
  seedDemoHistory(db, donor1, donor2);

  // --- Inventory ---
  const insInv = db.prepare(
    `INSERT INTO inventory_records (donor_id, item_name, food_category, quantity, unit, recorded_date, safe_until,
      shelf_life_days, storage_requirement, source, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const today = iso(daysAgo(0, 8));
  const inv: [number, string, string, number, string, number, number, string, string][] = [
    [donor1, 'Potatoes', 'Vegetables', 120, 'kg', 24 * 20, 20, 'ambient', 'in_stock'],
    [donor1, 'Bread Loaves', 'Bakery', 44, 'units', 30, 3, 'ambient', 'in_stock'],
    [donor1, 'Mixed Vegetables', 'Vegetables', 35, 'kg', 40, 4, 'refrigerated', 'in_stock'],
    [donor1, 'Yogurt (Doi)', 'Dairy', 28, 'units', 20, 5, 'refrigerated', 'in_stock'],
    [donor1, 'Mangoes', 'Fruits', 48, 'kg', 24 * 4, 6, 'ambient', 'in_stock'],
    [donor1, 'Chicken (raw)', 'Meat', 18, 'kg', 6, 1, 'refrigerated', 'in_stock'],
    [donor2, 'Tomatoes', 'Vegetables', 60, 'kg', 50, 4, 'refrigerated', 'in_stock'],
    [donor2, 'Milk Packs', 'Dairy', 80, 'units', 70, 4, 'refrigerated', 'in_stock'],
  ];
  for (const [d, name, cat, q, unit, safeHours, shelf, storage, status] of inv) {
    insInv.run(d, name, cat, q, unit, today, iso(hoursFromNow(safeHours)), shelf, storage, 'manual', status, today, today);
  }

  // --- Donations with full workflow history ---
  const insDon = db.prepare(
    `INSERT INTO donations (donor_id, item_name, food_category, description, quantity_available, unit, prepared_at, available_from,
      safe_until, storage_requirement, pickup_address, area, latitude, longitude, packaging, allergens, handling_instructions,
      contact_method, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insHistS = db.prepare(
    `INSERT INTO donation_status_history (donation_id, from_status, to_status, actor_user_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insReq = db.prepare(
    `INSERT INTO donation_requests (donation_id, recipient_id, requested_quantity, status, request_time, decision_time, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insCol = db.prepare(
    `INSERT INTO collections (donation_id, request_id, assigned_volunteer_id, task_status, scheduled_pickup_time, actual_pickup_time,
      actual_delivery_time, quantity_collected, quantity_delivered, received_as_expected, discrepancy, status, failure_reason, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const DONORS: Record<number, { addr: string; area: string; lat: number; lng: number }> = {
    [donor1]: { addr: 'House 27, Road 7, Dhanmondi', area: 'Dhanmondi', lat: 23.7461, lng: 90.3742 },
    [donor2]: { addr: 'Gulshan Avenue, Gulshan-1', area: 'Gulshan', lat: 23.7808, lng: 90.4167 },
  };

  type Outcome = 'delivered' | 'failed' | 'cancelled' | 'expired';
  const past: [number, number, string, string, number, string, string, number | null, Outcome, number][] = [
    // donor, daysAgo, item, category, qty, unit, storage, recipient, outcome, deliveredFraction
    [donor1, 148, 'Chicken Biryani', 'Prepared Food', 28, 'units', 'refrigerated', rec1, 'delivered', 1],
    [donor1, 140, 'Bread Loaves', 'Bakery', 18, 'units', 'ambient', rec2, 'delivered', 1],
    [donor2, 131, 'Tomatoes', 'Vegetables', 25, 'kg', 'refrigerated', rec3, 'delivered', 0.96],
    [donor1, 122, 'Vegetable Khichuri', 'Prepared Food', 22, 'units', 'refrigerated', rec1, 'delivered', 1],
    [donor1, 117, 'Buns & Pastries', 'Bakery', 12, 'units', 'ambient', rec2, 'failed', 0],
    [donor2, 109, 'Milk Packs', 'Dairy', 30, 'units', 'refrigerated', rec3, 'delivered', 1],
    [donor1, 101, 'Chicken Biryani', 'Prepared Food', 32, 'units', 'refrigerated', rec1, 'delivered', 0.94],
    [donor2, 95, 'Mixed Vegetables', 'Vegetables', 40, 'kg', 'refrigerated', rec3, 'delivered', 1],
    [donor1, 86, 'Bread Loaves', 'Bakery', 16, 'units', 'ambient', rec2, 'delivered', 1],
    [donor1, 78, 'Yogurt (Doi)', 'Dairy', 14, 'units', 'refrigerated', rec2, 'delivered', 1],
    [donor2, 71, 'Bananas', 'Fruits', 18, 'kg', 'ambient', null, 'expired', 0],
    [donor1, 64, 'Vegetable Khichuri', 'Prepared Food', 24, 'units', 'refrigerated', rec1, 'delivered', 1],
    [donor2, 56, 'Biscuits & Cakes', 'Bakery', 22, 'kg', 'ambient', rec3, 'delivered', 1],
    [donor1, 49, 'Chicken Biryani', 'Prepared Food', 36, 'units', 'refrigerated', rec1, 'delivered', 1],
    [donor1, 41, 'Buns & Pastries', 'Bakery', 14, 'units', 'ambient', rec2, 'cancelled', 0],
    [donor2, 33, 'Tomatoes', 'Vegetables', 30, 'kg', 'refrigerated', rec3, 'delivered', 0.97],
    [donor1, 26, 'Bread Loaves', 'Bakery', 20, 'units', 'ambient', rec1, 'delivered', 1],
    [donor1, 19, 'Mixed Vegetables', 'Vegetables', 20, 'kg', 'refrigerated', rec1, 'delivered', 1],
    [donor2, 12, 'Milk Packs', 'Dairy', 24, 'units', 'refrigerated', rec2, 'delivered', 1],
    [donor1, 6, 'Chicken Biryani', 'Prepared Food', 30, 'units', 'refrigerated', rec1, 'delivered', 1],
    [donor1, 3, 'Bread Loaves', 'Bakery', 18, 'units', 'ambient', rec2, 'delivered', 1],
  ];

  for (const [donor, ago, item, cat, qty, unit, storage, rec, outcome, frac] of past) {
    const L = DONORS[donor];
    const t0 = daysAgo(ago, 18);
    const step = (h: number) => iso(new Date(t0.getTime() + h * 3600_000));
    const safe = step(storage === 'ambient' && cat !== 'Bakery' ? 48 : cat === 'Prepared Food' ? 8 : 30);
    const id = Number(
      insDon.run(donor, item, cat, `Surplus ${item.toLowerCase()} from today's stock.`, qty, unit, step(-2), step(0), safe,
        storage, L.addr, L.area, L.lat, L.lng, 'Sealed food-grade containers', cat === 'Bakery' ? 'Gluten' : cat === 'Dairy' ? 'Milk' : '',
        storage === 'refrigerated' ? 'Keep chilled during transport' : 'Keep dry', 'Phone via platform', outcome, step(0), step(6)).lastInsertRowid
    );
    insHistS.run(id, null, 'available', donor, 'Donation published', step(0));
    if (outcome === 'expired') {
      insHistS.run(id, 'available', 'expired', null, 'Safe-use deadline passed (system)', safe);
      continue;
    }
    const reqId = Number(insReq.run(id, rec, qty, outcome === 'cancelled' ? 'cancelled' : 'accepted', step(0.5), step(1), null).lastInsertRowid);
    insHistS.run(id, 'available', 'requested', rec, 'Recipient requested donation', step(0.5));
    insHistS.run(id, 'requested', 'accepted', donor, 'Donor accepted request', step(1));
    if (outcome === 'cancelled') {
      insHistS.run(id, 'accepted', 'cancelled', donor, 'Donor cancelled: food used in-house', step(2));
      continue;
    }
    insHistS.run(id, 'accepted', 'scheduled', rec, 'Collection scheduled', step(1.5));
    if (outcome === 'failed') {
      insCol.run(id, reqId, null, 'failed', step(3), null, null, null, null, null, null, 'failed', 'Recipient vehicle unavailable before deadline', step(1.5), step(4));
      insHistS.run(id, 'scheduled', 'failed', rec, 'Collection failed: vehicle unavailable', step(4));
      continue;
    }
    const delivered = Math.round(qty * frac * 10) / 10;
    insCol.run(id, reqId, ago < 60 ? vol : null, 'delivered', step(3), step(3.2), step(4), qty, delivered, frac === 1 ? 1 : 0,
      frac === 1 ? null : 'Small quantity damaged in transit', 'delivered', null, step(1.5), step(4));
    insHistS.run(id, 'scheduled', 'collected', ago < 60 ? vol : donor, 'Picked up', step(3.2));
    insHistS.run(id, 'collected', 'delivered', rec, `Receipt confirmed: ${delivered} ${unit}`, step(4));
  }

  // --- Current, active donations ---
  const active = (donor: number, item: string, cat: string, qty: number, unit: string, storage: string, safeH: number, status: string, allergens = '') => {
    const L = DONORS[donor];
    const now = iso(new Date(Date.now() - 3600_000));
    const id = Number(
      insDon.run(donor, item, cat, `Fresh surplus ${item.toLowerCase()}, prepared today.`, qty, unit, now, now, iso(hoursFromNow(safeH)),
        storage, L.addr, L.area, L.lat, L.lng, 'Sealed food-grade containers', allergens,
        storage === 'refrigerated' ? 'Keep chilled during transport' : 'Keep dry', 'Phone via platform', status, now, now).lastInsertRowid
    );
    insHistS.run(id, null, 'available', donor, 'Donation published', now);
    return id;
  };
  active(donor1, 'Vegetable Khichuri', 'Prepared Food', 24, 'units', 'refrigerated', 5, 'available');
  active(donor1, 'Bread Loaves', 'Bakery', 18, 'units', 'ambient', 30, 'available', 'Gluten');
  const reqd = active(donor1, 'Buns & Pastries', 'Bakery', 12, 'units', 'ambient', 26, 'requested', 'Gluten, Eggs');
  insReq.run(reqd, rec2, 12, 'pending', iso(new Date(Date.now() - 1800_000)), null, 'We can collect this evening.');
  insHistS.run(reqd, 'available', 'requested', rec2, 'Recipient requested donation', iso(new Date(Date.now() - 1800_000)));
  const sch = active(donor1, 'Mixed Vegetables', 'Vegetables', 20, 'kg', 'refrigerated', 40, 'scheduled');
  const schReq = Number(insReq.run(sch, rec1, 20, 'accepted', iso(new Date(Date.now() - 2400_000)), iso(new Date(Date.now() - 2000_000)), null).lastInsertRowid);
  insHistS.run(sch, 'available', 'requested', rec1, 'Recipient requested donation', iso(new Date(Date.now() - 2400_000)));
  insHistS.run(sch, 'requested', 'accepted', donor1, 'Donor accepted request', iso(new Date(Date.now() - 2000_000)));
  insHistS.run(sch, 'accepted', 'scheduled', rec1, 'Collection scheduled', iso(new Date(Date.now() - 1500_000)));
  insCol.run(sch, schReq, vol, 'assigned', iso(hoursFromNow(3)), null, null, null, null, null, null, 'scheduled', null, iso(new Date()), iso(new Date()));
  active(donor2, 'Tomatoes', 'Vegetables', 28, 'kg', 'refrigerated', 50, 'available');
  active(donor2, 'Bananas', 'Fruits', 15, 'kg', 'ambient', 36, 'available');
  active(donor2, 'Frozen Fish', 'Meat', 10, 'kg', 'frozen', 24 * 4, 'available', 'Fish');

  // --- Reports, notifications, audit ---
  db.prepare(`INSERT INTO reports (donation_id, reporter_id, reason, details, status, created_at) VALUES (?, ?, ?, ?, 'open', ?)`)
    .run(reqd, rec2, 'Incomplete allergen information', 'Please confirm whether pastries contain nuts.', iso(new Date(Date.now() - 900_000)));

  const insN = db.prepare(`INSERT INTO notifications (user_id, title, message, link, related_entity_type, related_entity_id, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  insN.run(donor1, 'New donation request', 'Hope Shelter Mohammadpur requested Buns & Pastries (6 kg).', `/app/donations/${reqd}`, 'donation', reqd, 0, iso(new Date(Date.now() - 1800_000)));
  insN.run(donor1, 'Collection scheduled', 'Mirpur Community Kitchen scheduled pickup for Mixed Vegetables.', `/app/donations/${sch}`, 'donation', sch, 1, iso(new Date(Date.now() - 1500_000)));
  insN.run(rec1, 'Request accepted', 'Dhanmondi Kitchen & Bakery accepted your request for Mixed Vegetables.', `/app/donations/${sch}`, 'donation', sch, 0, iso(new Date(Date.now() - 2000_000)));
  insN.run(vol, 'New collection task', 'You have been assigned to collect Mixed Vegetables (20 kg).', `/app/tasks`, 'donation', sch, 0, iso(new Date(Date.now() - 1400_000)));
  insN.run(admin, 'New verification request', "Uttara Children's Home submitted verification details.", `/app/admin/verifications`, 'user', rec4, 0, iso(daysAgo(3)));

  const insA = db.prepare(`INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, timestamp, reason, relevant_metadata) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  for (const [uid, ago] of [[donor1, 158], [donor2, 118], [rec1, 157], [rec2, 138], [rec3, 98]] as const) {
    insA.run(admin, 'verification.approve', 'user', uid, iso(daysAgo(ago)), 'Documents reviewed', JSON.stringify({ to: 'verified' }));
  }

  db.prepare('UPDATE collections SET needs_volunteer = 1 WHERE assigned_volunteer_id IS NOT NULL').run();

  // One accepted donation where the recipient asked for volunteer help (open task).
  const open = active(donor2, 'Potato Sacks', 'Vegetables', 35, 'kg', 'ambient', 24 * 10, 'scheduled');
  const openReq = Number(insReq.run(open, rec3, 35, 'accepted', iso(new Date(Date.now() - 5000_000)), iso(new Date(Date.now() - 4800_000)), null).lastInsertRowid);
  insHistS.run(open, 'available', 'requested', rec3, 'Recipient requested donation', iso(new Date(Date.now() - 5000_000)));
  insHistS.run(open, 'requested', 'accepted', donor2, 'Donor accepted request', iso(new Date(Date.now() - 4800_000)));
  insHistS.run(open, 'accepted', 'scheduled', rec3, 'Collection scheduled — volunteer help requested', iso(new Date(Date.now() - 4600_000)));
  insCol.run(open, openReq, null, 'unassigned', iso(hoursFromNow(20)), null, null, null, null, null, null, 'scheduled', null, iso(new Date()), iso(new Date()));
  db.prepare('UPDATE collections SET needs_volunteer = 1 WHERE donation_id = ?').run(open);

  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('demo_mode', '1')`).run();
}

function seedDemoHistory(db: Database, donor1: number, donor2: number) {
  const n1 = seedKaggleHistory(db, donor1, 'Restaurant', 150);
  const n2 = seedKaggleHistory(db, donor2, 'Supermarket', 150);
  const insImp = db.prepare(
    `INSERT INTO csv_imports (user_id, file_name, import_status, row_count, error_count, validation_report, created_at)
     VALUES (?, 'kaggle_food_waste_sample.csv', 'imported', ?, 0, ?, ?)`
  );
  const note = JSON.stringify({ errors: [], warnings: [], note: 'Demo history sampled from the Kaggle food-waste dataset (dates shifted)' });
  const when = new Date(Date.now() - 86400_000).toISOString();
  if (n1) insImp.run(donor1, n1, note, when);
  if (n2) insImp.run(donor2, n2, note, when);
  return n1 + n2;
}

/** Repair step for an already-seeded database: load the Kaggle history for the demo donors if they have none. */
export function ensureDemoHistory(db: Database): number {
  const id = (email: string) => db.prepare('SELECT id FROM users WHERE email = ?').get(email)?.id as number | undefined;
  const d1 = id('donor@foodsphere.test');
  const d2 = id('donor2@foodsphere.test');
  if (!d1 || !d2) return 0;
  const have = Number(db.prepare('SELECT COUNT(*) AS n FROM sales_history WHERE donor_id IN (?, ?)').get(d1, d2)?.n ?? 0);
  if (have > 0) return 0;
  db.exec('BEGIN');
  try {
    const n = seedDemoHistory(db, d1, d2);
    db.exec('COMMIT');
    return n;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** Insert Kaggle rows for one business type as a donor's history. Returns the number of rows inserted. */
function seedKaggleHistory(db: Database, donorId: number, businessType: string, days: number): number {
  const file = path.join(process.cwd(), 'ml', 'waste', 'data', 'raw', 'food_waste_dataset.csv');
  if (!fs.existsSync(file)) {
    console.warn(`[seed] Kaggle dataset not found at ${file}: demo donors get no sales history.`);
    return 0;
  }
  const grid = parseCsv(fs.readFileSync(file, 'utf8'), 50000);
  const head = grid[0].map((h) => h.trim());
  const col = (name: string) => head.indexOf(name);
  const C = { date: col('Date'), bt: col('Business_Type'), cat: col('Food_Category'), p: col('Purchase_Quantity'), s: col('Units_Sold'), w: col('Waste_Quantity'),
    shelf: col('Shelf_Life_Days'), temp: col('Storage_Temperature'), promo: col('Promotion'), weather: col('Weather') };
  const seen = new Set<string>();
  const rows: string[][] = [];
  for (const r of grid.slice(1)) {
    if (r[C.bt] !== businessType) continue;
    const key = `${r[C.date]}|${r[C.cat]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(r);
  }
  if (!rows.length) return 0;
  const lastKaggle = rows.reduce((m, r) => (r[C.date] > m ? r[C.date] : m), '');
  const yesterday = new Date(Date.now() + 6 * 3600_000 - 86400_000).toISOString().slice(0, 10);
  const shift = Math.round((Date.parse(yesterday) - Date.parse(lastKaggle)) / 86400_000);
  const from = new Date(Date.parse(lastKaggle) - (days - 1) * 86400_000).toISOString().slice(0, 10);
  const ins = db.prepare(
    `INSERT OR IGNORE INTO sales_history (donor_id, date, business_type, food_category, purchase_quantity, units_sold, waste_quantity,
      shelf_life_days, storage_temperature, promotion, weather) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  let n = 0;
  for (const r of rows) {
    if (r[C.date] < from) continue;
    const d = new Date(Date.parse(r[C.date]) + shift * 86400_000).toISOString().slice(0, 10);
    const num = (v: string) => (v === '' || v == null ? null : Number(v));
    ins.run(donorId, d, businessType, r[C.cat], Number(r[C.p]), Number(r[C.s]), Number(r[C.w]) || 0, num(r[C.shelf]), num(r[C.temp]),
      r[C.promo] === 'Yes' ? 1 : 0, r[C.weather] || null);
    n++;
  }
  return n;
}
