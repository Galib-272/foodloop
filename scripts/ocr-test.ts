/* OCR check for "Quick fill from photo": Tesseract reads a photographed donor note (scripts/fixtures/ocr-donor-note.png),
   the text is cleaned exactly like in the browser (lib/ocr.ts), and the AI extraction turns it into donation fields.
   Runs offline: the English model comes from the @tesseract.js-data/eng dev dependency. Run: npm run test:ocr */
import path from 'path';
import { createWorker } from 'tesseract.js';
import { cleanOcrText } from '../lib/ocr';
import { extractDonation } from '../lib/extract';

const root = process.cwd();
let fails = 0;
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++; };

(async () => {
  delete process.env.OLLAMA_URL; // test the deterministic path; the local model only adds to it
  const worker = await createWorker('eng', 1, {
    langPath: path.join(root, 'node_modules/@tesseract.js-data/eng/4.0.0_best_int'),
    cacheMethod: 'none',
    gzip: true,
  });
  const t0 = Date.now();
  const { data } = await worker.recognize(path.join(root, 'scripts/fixtures/ocr-donor-note.png'));
  await worker.terminate();
  const text = cleanOcrText(data.text);
  console.log(`[ocr] ${((Date.now() - t0) / 1000).toFixed(1)}s, confidence ${Math.round(data.confidence)}%: ${text}`);
  ok(data.confidence >= 70, `OCR confidence ${Math.round(data.confidence)}% (>= 70%)`);
  ok(/20 boxes of chicken biryani/i.test(text) && /contains:? nuts/i.test(text), 'OCR read the food line and the allergen line');
  ok(text.length <= 500 && !text.includes('\n'), 'cleaned into one line within the 500-character limit');

  const now = new Date('2026-11-11T12:00:00+06:00');
  const r = await extractDonation(text, now);
  const f = r.fields;
  console.log('[extract]', JSON.stringify(f));
  ok(f.item_name === 'Chicken biryani', `item name: ${f.item_name}`);
  ok(f.quantity_available === 20 && f.unit === 'units' && f.packaging === 'Boxes', `quantity: ${f.quantity_available} ${f.unit}, packaging ${f.packaging}`);
  ok(f.food_category === 'Prepared Food', `category: ${f.food_category}`);
  ok(f.storage_requirement === 'refrigerated', `storage: ${f.storage_requirement}`);
  ok(f.allergens === 'nuts', `allergens: ${f.allergens}`);
  ok(!!f.safe_until && new Date(String(f.safe_until)).getUTCHours() === 17, `safe until 11pm Dhaka: ${f.safe_until}`);
  ok(!JSON.stringify(r).includes('345678') && r.notes.some((n) => /Contact details were removed/.test(n)), 'phone number from the photo removed before extraction');
  console.log(fails ? `\n${fails} OCR CHECK(S) FAILED` : '\nOCR CHECKS PASSED');
  process.exit(fails ? 1 : 0);
})();
