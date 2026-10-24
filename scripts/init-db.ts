/*
 * Prepares the database before the app starts (used by `npm run vercel-build` on Vercel).
 * With TURSO_DATABASE_URL set it creates the tables and demo data in Turso once; later deploys skip it.
 */
import { getDb } from '../lib/db';
import { ensureDemoHistory } from '../lib/seed';

const t0 = Date.now();
const db = getDb();
const added = ensureDemoHistory(db); // repairs a database seeded without the Kaggle file
const users = db.prepare('SELECT COUNT(*) AS n FROM users').get();
const hist = db.prepare('SELECT COUNT(*) AS n FROM sales_history').get();
console.log(`[init-db] ${process.env.TURSO_DATABASE_URL ? 'Turso' : 'local'} database ready: ${users?.n} users, ${hist?.n} sales-history rows${added ? ` (${added} added now)` : ''} (${Date.now() - t0} ms)`);
if (!Number(hist?.n)) throw new Error('[init-db] No sales history: is ml/waste/data/raw/food_waste_dataset.csv included in the upload?');
