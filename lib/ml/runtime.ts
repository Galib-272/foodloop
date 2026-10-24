/*
 * Minimal inference engine for models exported by ml/common/export.py (scikit-learn -> JSON).
 * Supports linear/logistic regression, decision trees, random forests, gradient boosting and KNN,
 * optionally preceded by a StandardScaler. Parity with scikit-learn is checked by golden tests.
 */

type Tree = { f: number[]; t: number[]; l: number[]; r: number[]; v: number[] | number[][] };

export type ExportedModel = { scaler?: { mean: number[]; scale: number[] } } & (
  | { type: 'linear'; coef: number[]; intercept: number }
  | { type: 'logistic'; classes: string[]; coef: number[][]; intercept: number[] }
  | { type: 'forest_reg'; trees: Tree[] }
  | { type: 'forest_clf'; classes: string[]; trees: Tree[] }
  | { type: 'gbm_reg'; init: number; lr: number; trees: Tree[] }
  | { type: 'gbm_clf'; classes: string[]; init: number[]; lr: number; trees: Tree[][] }
  | { type: 'knn_reg'; k: number; weights: string; X: number[][]; y: number[] }
  | { type: 'knn_clf'; classes: string[]; k: number; weights: string; X: number[][]; y: number[] }
);

function leaf(t: Tree, x: number[]): number {
  let n = 0;
  while (t.l[n] !== -1) n = Math.fround(x[t.f[n]]) <= t.t[n] ? t.l[n] : t.r[n];
  return n;
}

const softmax = (z: number[]) => {
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
};
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

function scale(m: ExportedModel, x: number[]) {
  if (!m.scaler) return x;
  return x.map((v, i) => (v - m.scaler!.mean[i]) / (m.scaler!.scale[i] || 1));
}

function knn(X: number[][], x: number[], k: number) {
  const d = X.map((row, i) => {
    let s = 0;
    for (let j = 0; j < row.length; j++) s += (row[j] - x[j]) ** 2;
    return [Math.sqrt(s), i] as [number, number];
  });
  d.sort((a, b) => a[0] - b[0]);
  return d.slice(0, k);
}

/** Regression output. */
export function predictValue(m: ExportedModel, raw: number[]): number {
  const x = scale(m, raw);
  switch (m.type) {
    case 'linear':
      return m.intercept + m.coef.reduce((s, c, i) => s + c * x[i], 0);
    case 'forest_reg':
      return m.trees.reduce((s, t) => s + (t.v as number[])[leaf(t, x)], 0) / m.trees.length;
    case 'gbm_reg':
      return m.init + m.lr * m.trees.reduce((s, t) => s + (t.v as number[])[leaf(t, x)], 0);
    case 'knn_reg': {
      const nb = knn(m.X, x, m.k);
      if (m.weights === 'distance') {
        const exact = nb.find(([d]) => d === 0);
        if (exact) return m.y[exact[1]];
        const w = nb.map(([d]) => 1 / d);
        return nb.reduce((s, [, i], j) => s + w[j] * m.y[i], 0) / w.reduce((a, b) => a + b, 0);
      }
      return nb.reduce((s, [, i]) => s + m.y[i], 0) / nb.length;
    }
    default:
      throw new Error(`Model type ${m.type} is not a regressor`);
  }
}

/** Class probabilities, in the order of m.classes. */
export function predictProba(m: ExportedModel, raw: number[]): { classes: string[]; proba: number[] } {
  const x = scale(m, raw);
  switch (m.type) {
    case 'logistic': {
      const z = m.coef.map((row, k) => m.intercept[k] + row.reduce((s, c, i) => s + c * x[i], 0));
      if (m.classes.length === 2 && z.length === 1) {
        const p = sigmoid(z[0]);
        return { classes: m.classes, proba: [1 - p, p] };
      }
      return { classes: m.classes, proba: softmax(z) };
    }
    case 'forest_clf': {
      const acc = new Array(m.classes.length).fill(0);
      for (const t of m.trees) {
        const v = (t.v as number[][])[leaf(t, x)];
        for (let k = 0; k < acc.length; k++) acc[k] += v[k];
      }
      return { classes: m.classes, proba: acc.map((a) => a / m.trees.length) };
    }
    case 'gbm_clf': {
      const raws = [...m.init];
      for (const stage of m.trees) stage.forEach((t, k) => (raws[k] += m.lr * (t.v as number[])[leaf(t, x)]));
      if (raws.length === 1) {
        const p = sigmoid(raws[0]);
        return { classes: m.classes, proba: [1 - p, p] };
      }
      return { classes: m.classes, proba: softmax(raws) };
    }
    case 'knn_clf': {
      const nb = knn(m.X, x, m.k);
      const acc = new Array(m.classes.length).fill(0);
      const exact = nb.filter(([d]) => d === 0);
      const use = m.weights === 'distance' && exact.length ? exact : nb;
      for (const [d, i] of use) acc[m.y[i]] += m.weights === 'distance' && !exact.length ? 1 / d : 1;
      const s = acc.reduce((a, b) => a + b, 0);
      return { classes: m.classes, proba: acc.map((a) => a / s) };
    }
    default:
      throw new Error(`Model type ${m.type} is not a classifier`);
  }
}
