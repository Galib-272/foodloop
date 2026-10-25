import index from './index.json';

/**
 * "Ask FoodSphere" for the web app: the same agent flow as rag/agent.py (LangGraph), in TypeScript.
 *   retrieve (hybrid: LSA vectors + BM25 keywords, fused with Reciprocal Rank Fusion, over contextual chunks)
 *   -> grade (are the question's words covered?) -> widen and retry once -> generate or refuse.
 * Generation uses a local Ollama model when OLLAMA_URL is set (local development); otherwise an extractive answer
 * that quotes the best sentences, so the live site works without any AI service.
 * The index (lib/rag/index.json) is built by rag/ingest.py; lib/rag/golden.json checks Python/TypeScript parity.
 */

type IndexChunk = (typeof index.chunks)[number];
export type Hit = Omit<IndexChunk, 'vec'> & { score: number; vectorRank: number | null; keywordRank: number | null };
export type AskResult = {
  question: string;
  answer: string;
  citations: number[];
  generator: string;
  hits: Hit[];
  coverage: number;
  trace: string[];
  ms: number;
};

const STOP = new Set(index.stopwords);
const VOCAB = new Map(index.vocab.map((w, i) => [w, i] as const));
const IDF = index.idf;
const COMPONENTS = index.components;

export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (let t of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    if (STOP.has(t) || t.length < 2) continue;
    if (t.length > 4 && t.endsWith('s') && !t.endsWith('ss')) t = t.slice(0, -1);
    out.push(t);
  }
  return out;
}

function norm(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return n ? v.map((x) => x / n) : v;
}

/** LSA query embedding: sublinear TF-IDF, L2-normalised, projected onto the SVD components, normalised again. */
export function embed(text: string): number[] {
  const tf = new Map<number, number>();
  for (const w of tokenize(text)) {
    const i = VOCAB.get(w);
    if (i !== undefined) tf.set(i, (tf.get(i) ?? 0) + 1);
  }
  const entries = Array.from(tf).map(([i, c]) => [i, (1 + Math.log(c)) * IDF[i]] as const);
  const n = Math.sqrt(entries.reduce((s, [, x]) => s + x * x, 0)) || 1;
  return norm(COMPONENTS.map((row) => entries.reduce((s, [i, x]) => s + row[i] * (x / n), 0)));
}

const CHUNK_TOKENS = index.chunks.map((c) => tokenize(c.context ? `${c.context}\n\n${c.text}` : c.text));
const AVG_LEN = CHUNK_TOKENS.reduce((s, t) => s + t.length, 0) / CHUNK_TOKENS.length;
const DF = new Map<string, number>();
for (const toks of CHUNK_TOKENS) Array.from(new Set(toks)).forEach((w) => DF.set(w, (DF.get(w) ?? 0) + 1));
const CHUNK_TF = CHUNK_TOKENS.map((toks) => {
  const m = new Map<string, number>();
  for (const w of toks) m.set(w, (m.get(w) ?? 0) + 1);
  return m;
});

function bm25(query: string[], k1 = 1.2, b = 0.75): number[] {
  const n = CHUNK_TOKENS.length;
  const q = Array.from(new Set(query));
  return CHUNK_TF.map((tf, i) => {
    let s = 0;
    for (const w of q) {
      const f = tf.get(w);
      if (!f) continue;
      const df = DF.get(w)!;
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
      s += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * CHUNK_TOKENS[i].length) / AVG_LEN));
    }
    return s;
  });
}

/** Hybrid search: top `pool` by cosine similarity and by BM25, fused with RRF (k = 60). */
export function search(question: string, k = 4, pool = 20): Hit[] {
  const q = embed(question);
  const hasVec = q.some((x) => x !== 0);
  const byVec = hasVec
    ? index.chunks.map((c, i) => [i, c.vec.reduce((s, x, j) => s + x * q[j], 0)] as const).sort((a, b) => b[1] - a[1]).slice(0, pool)
    : [];
  const kw = bm25(tokenize(question));
  const byKw = kw.map((s, i) => [i, s] as const).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).slice(0, pool);
  const scores = new Map<number, number>();
  const vRank = new Map<number, number>();
  const kRank = new Map<number, number>();
  byVec.forEach(([i], r) => { vRank.set(i, r + 1); scores.set(i, (scores.get(i) ?? 0) + 1 / (60 + r + 1)); });
  byKw.forEach(([i], r) => { kRank.set(i, r + 1); scores.set(i, (scores.get(i) ?? 0) + 1 / (60 + r + 1)); });
  return Array.from(scores)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, k)
    .map(([i, score]) => {
      const { vec: _vec, ...c } = index.chunks[i];
      return { ...c, score: Math.round(score * 1e5) / 1e5, vectorRank: vRank.get(i) ?? null, keywordRank: kRank.get(i) ?? null };
    });
}

export function coverage(question: string, hits: Hit[]): number {
  const q = new Set(tokenize(question));
  if (!q.size || !hits.length) return 0;
  const seen = new Set(tokenize(hits.slice(0, 3).map((h) => `${h.context} ${h.text}`).join(' ')));
  return Array.from(q).filter((w) => seen.has(w)).length / q.size;
}

function extractive(question: string, hits: Hit[]): { text: string; citations: number[] } {
  const q = new Set(tokenize(question));
  const best: [number, number, string][] = [];
  hits.slice(0, 3).forEach((h, idx) => {
    for (let s of h.text.split(/(?<=[.!?])\s+|\n+/)) {
      s = s.replace(/^[\s\-*]+|[\s\-*]+$/g, '');
      if (s.length > 25) best.push([tokenize(s).filter((w) => q.has(w)).length + (idx === 0 ? 0.5 : 0), idx + 1, s]);
    }
  });
  best.sort((a, b) => b[0] - a[0]);
  const picked = best.slice(0, 2).filter((b) => b[0] > 0);
  const use = picked.length ? picked : best.slice(0, 1);
  return { text: use.map(([, n, s]) => `${s} [${n}]`).join(' '), citations: Array.from(new Set(use.map(([, n]) => n))).sort((a, b) => a - b) };
}

const SYSTEM = `You are Ask FoodSphere, the help assistant of FoodSphere AI, a food rescue platform in Bangladesh.
Answer the question using ONLY the numbered sources. Keep the answer to 1-3 short sentences.
Cite the sources you used like [1] or [2]. If the sources do not contain the answer, say "I don't know based on the FoodSphere documents." Do not invent facts.`;

export const REFUSAL =
  "I couldn't find this in the FoodSphere AI knowledge base, so I won't guess. Try asking about donations, food safety, roles, the AI models or the platform's data.";

async function ollamaAnswer(question: string, hits: Hit[]): Promise<{ text: string; citations: number[]; model: string } | null> {
  const url = process.env.OLLAMA_URL;
  if (!url) return null;
  const model = process.env.OLLAMA_MODEL || 'qwen2.5:1.5b';
  const sources = hits.map((h, i) => `[${i + 1}] (${h.docTitle} > ${h.section})\n${h.text}`).join('\n\n');
  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, stream: false, options: { temperature: 0, num_predict: 400, seed: 7 },
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: `Sources:\n${sources}\n\nQuestion: ${question}` }],
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { message?: { content?: string } };
    const text = (j.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    if (!text) return null;
    const nums = (text.match(/\[(\d+)\]/g) ?? []).map((m) => Number(m.slice(1, -1))).filter((n) => n > 0 && n <= hits.length);
    const citations = Array.from(new Set(nums)).sort((a, b) => a - b);
    return { text, citations, model };
  } catch {
    return null;
  }
}

export async function ask(question: string): Promise<AskResult> {
  const t0 = Date.now();
  const trace: string[] = [];
  let k = 4;
  let hits: Hit[] = [];
  let cov = 0;
  for (let attempt = 1; attempt <= 2; attempt++) {
    hits = search(question, k);
    trace.push(`retrieve: ${hits.length} chunks (k=${k})`);
    cov = coverage(question, hits);
    const ok = cov >= 0.5;
    trace.push(`grade: coverage ${cov.toFixed(2)} -> ${ok ? 'relevant' : 'not relevant'}`);
    if (ok) {
      const llm = await ollamaAnswer(question, hits);
      if (llm) {
        trace.push(`generate: ${llm.model}`);
        return { question, answer: llm.text, citations: llm.citations, generator: llm.model, hits, coverage: cov, trace, ms: Date.now() - t0 };
      }
      const ex = extractive(question, hits);
      trace.push('generate: extractive');
      return { question, answer: ex.text, citations: ex.citations, generator: 'extractive', hits, coverage: cov, trace, ms: Date.now() - t0 };
    }
    if (attempt === 1) { k = 8; trace.push('widen: search again with more results'); }
  }
  trace.push('refuse: not covered');
  return { question, answer: REFUSAL, citations: [], generator: 'refusal', hits: [], coverage: cov, trace, ms: Date.now() - t0 };
}

export const INDEX_INFO = { builtAt: index.builtAt, chunks: index.chunks.length, dims: index.dims };
