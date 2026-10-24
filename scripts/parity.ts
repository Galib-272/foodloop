/* Parity check: TypeScript inference must reproduce the Python (scikit-learn) outputs saved in lib/model/*-golden.json. */
import fs from 'fs';
import path from 'path';
import { buildWasteFeatures, loadWasteModel } from '../lib/ml/waste';
import { buildMatchFeatures, loadMatchModel, predictMatch, type MatchInput } from '../lib/ml/matching';
import { predictProba, predictValue } from '../lib/ml/runtime';

const read = (f: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'lib', 'model', f), 'utf8'));
let worst = { feat: 0, demand: 0, proba: 0, match: 0, matchFeat: 0 };
const w = loadWasteModel()!;
const wg = read('waste-golden.json');
wg.inputs.forEach((inp: any, i: number) => {
  const { named } = buildWasteFeatures(inp, w.artifacts);
  const x = w.features.map((n) => named[n]);
  x.forEach((v, j) => (worst.feat = Math.max(worst.feat, Math.abs(v - wg.features[i][j]))));
  worst.demand = Math.max(worst.demand, Math.abs(predictValue(w.leftover.model, x) - wg.demand[i]));
  const { proba } = predictProba(w.waste_level.model, x);
  proba.forEach((p, j) => (worst.proba = Math.max(worst.proba, Math.abs(p - wg.proba[i][j]))));
});
const m = loadMatchModel()!;
const mg = read('matching-golden.json');
mg.inputs.forEach((inp: MatchInput, i: number) => {
  const f = buildMatchFeatures(inp, m.artifacts);
  m.features.forEach((n, j) => (worst.matchFeat = Math.max(worst.matchFeat, Math.abs(f[n] - mg.features[i][j]))));
  worst.match = Math.max(worst.match, Math.abs(predictMatch(inp, m)! - mg.proba[i]));
});
console.log(`waste cases ${wg.inputs.length}, matching cases ${mg.inputs.length}`);
console.log('max abs diff', worst);
const ok = worst.feat < 1e-4 && worst.demand < 1e-3 && worst.proba < 1e-4 && worst.matchFeat < 1e-4 && worst.match < 1e-4;
console.log(ok ? 'PARITY OK' : 'PARITY FAILED');
process.exit(ok ? 0 : 1);
