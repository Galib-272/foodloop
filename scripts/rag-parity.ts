/* Parity check: the live site's TypeScript search (lib/rag/search.ts) must return the same chunks, in the same order,
   as the Python reference in rag/ingest.py, for every case saved in lib/rag/golden.json. */
import fs from 'fs';
import path from 'path';
import { embed, search } from '../lib/rag/search';

const golden = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'lib', 'rag', 'golden.json'), 'utf8')) as {
  cases: { q: string; top: number[]; vec: number[] }[];
};
let worstVec = 0;
const mismatches: string[] = [];
for (const c of golden.cases) {
  const v = embed(c.q);
  v.forEach((x, i) => (worstVec = Math.max(worstVec, Math.abs(x - c.vec[i]))));
  const top = search(c.q).map((h) => h.id);
  if (JSON.stringify(top) !== JSON.stringify(c.top)) mismatches.push(`${c.q}: ts ${top} vs py ${c.top}`);
}
console.log(`rag cases ${golden.cases.length}, max embedding diff ${worstVec.toExponential(2)}, ranking mismatches ${mismatches.length}`);
mismatches.forEach((m) => console.log('  ' + m));
const ok = worstVec < 1e-4 && mismatches.length === 0;
console.log(ok ? 'RAG PARITY OK' : 'RAG PARITY FAILED');
process.exit(ok ? 0 : 1);
