import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, BarChart3, Bot, Boxes, BrainCircuit, Database, FileSearch, GitBranch, Github, Layers, Network, PlugZap, ShieldCheck, Sparkles, Workflow,
} from 'lucide-react';
import { Navbar } from '@/components/site/navbar';
import { Footer } from '@/components/site/footer';
import { Button } from '@/components/ui/button';
import metrics from '@/lib/docs/metrics.json';

export const metadata: Metadata = {
  title: 'Docs — FoodLoop',
  description: 'How FoodLoop works: architecture, AI models with their test metrics, the Ask FoodLoop assistant, the data pipeline, MCP servers and safety.',
};

const pct = (x: number | null | undefined, d = 1) => (x == null ? '–' : `${(x * 100).toFixed(d)}%`);
const NAV = [
  ['overview', 'Overview'], ['how', 'How it works'], ['architecture', 'Architecture'], ['models', 'AI models'], ['assistant', 'Ask FoodLoop'],
  ['data', 'Data pipeline'], ['mcp', 'MCP servers'], ['automation', 'Automation'], ['safety', 'Safety & privacy'], ['stack', 'Tech stack'],
  ['limits', 'Honest limits'], ['try', 'Try it'],
] as const;

function Section({ id, icon: Icon, title, children }: { id: string; icon: typeof Sparkles; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t pt-10">
      <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Icon className="h-6 w-6 text-secondary" aria-hidden /> {title}</h2>
      <div className="mt-4 space-y-4 leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function Stat({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{label}</p>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/60 text-foreground">
          <tr>{head.map((h) => <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className={j === 0 ? 'px-3 py-2 font-medium text-foreground' : 'px-3 py-2'}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Box({ title, items, tone = 'card' }: { title: string; items: string[]; tone?: 'card' | 'accent' | 'muted' }) {
  const cls = tone === 'accent' ? 'border-secondary/40 bg-accent/40' : tone === 'muted' ? 'bg-muted/40' : 'bg-card';
  return (
    <div className={`rounded-xl border p-3 ${cls}`}>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <ul className="mt-1.5 space-y-0.5 text-xs">{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </div>
  );
}

const Down = () => <div className="flex justify-center text-secondary" aria-hidden>↓</div>;

export default function DocsPage() {
  const w = metrics.waste!;
  const m = metrics.matching!;
  const rag = metrics.rag!;
  const best = rag.retrieval.reduce((a, b) => (b.mrr > a.mrr ? b : a));
  const graphRow = rag.retrieval.find((r) => r.search === 'graph');
  type ModelRow = { model: string; answer_accuracy: number; citation_rate: number; refusal_accuracy: number | null; median_seconds: number | null };
  const llms = rag.models as unknown as ModelRow[];
  const lake = metrics.lakehouse as Record<string, { rows: number; version: number; partitions: string[] }> | null;

  return (
    <>
      <Navbar />
      <main className="bg-grain">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:grid lg:grid-cols-[200px_1fr] lg:gap-12 lg:py-20">
          <nav aria-label="On this page" className="hidden lg:block">
            <ul className="sticky top-24 space-y-1 text-sm">
              {NAV.map(([id, label]) => (
                <li key={id}><a href={`#${id}`} className="block rounded-md px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground">{label}</a></li>
              ))}
            </ul>
          </nav>

          <article className="min-w-0 space-y-12">
            <header id="overview">
              <p className="text-sm font-semibold uppercase tracking-wider text-secondary">Documentation · Food Waste Zero</p>
              <h1 className="mt-2 text-balance text-4xl font-bold tracking-tight sm:text-5xl">FoodLoop</h1>
              <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">
                AI that predicts surplus food before it is wasted and routes it to the NGOs, shelters and community kitchens that can use it,
                in time. This page explains how it works, what the AI does, how well it does it, and where its limits are.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild><Link href="/login">Open the live demo <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
                <Button asChild variant="outline"><a href="https://github.com/Galib-272/foodloop" target="_blank" rel="noreferrer"><Github className="h-4 w-4" aria-hidden /> Source code</a></Button>
              </div>
              <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3">
                <Stat value={`${w.mae.toFixed(1)} units`} label="Leftover forecast error" note={`MAE on unseen days, R² ${w.r2}; average baseline ${w.baseline_mae.toFixed(1)}`} />
                <Stat value={pct(w.accuracy)} label="Waste-risk accuracy" note={`Low/Medium/High; baseline ${pct(w.baseline_accuracy)}`} />
                <Stat value={pct(m.accuracy)} label="Matching accuracy" note={`Will a delivery succeed? Baseline ${pct(m.baseline_accuracy)} (synthetic data)`} />
                <Stat value={pct(graphRow?.hit1 ?? best.hit1, 0)} label="Assistant finds the right section first" note={`hybrid + graph search, ${rag.questions} test questions`} />
                <Stat value={pct(rag.graph_fact_accuracy, 0)} label="Knowledge-graph facts correct" note={`${rag.graph_questions} rule questions, Kùzu graph`} />
                <Stat value="10" label="MCP tools in 3 servers" note="forecast, knowledge, warehouse" />
              </div>
            </header>

            <Section id="how" icon={Workflow} title="How it works">
              <ol className="grid gap-3 md:grid-cols-3">
                {[
                  ['1. Forecast', 'Each morning a donor sees how much of each food is likely to be left over and the waste risk, with the weather filled in automatically.'],
                  ['2. Publish', 'Surplus is listed in a few clicks, or from one sentence with AI quick fill. The donor confirms a verified safe-use deadline.'],
                  ['3. Safety rules', 'Organizations that are not verified, do not accept the food, lack the storage, cannot receive before the deadline or are full are excluded.'],
                  ['4. AI matching', 'The remaining organizations are ranked by a model that estimates the chance of a successful delivery, with a reason for each.'],
                  ['5. Collect & deliver', 'The donor accepts a request, a pickup is scheduled, a volunteer can collect, and the organization confirms what arrived.'],
                  ['6. Impact & alerts', 'Dashboards count only confirmed deliveries. n8n alerts admins when food is about to expire or a pickup fails.'],
                ].map(([t, d]) => (
                  <li key={t} className="rounded-xl border bg-card p-4"><p className="font-semibold text-foreground">{t}</p><p className="mt-1 text-sm">{d}</p></li>
                ))}
              </ol>
            </Section>

            <Section id="architecture" icon={Layers} title="Architecture">
              <p>Everything the live site needs runs inside the Next.js app, so it works on Vercel without any paid AI service. Heavier AI work runs offline or on a local machine.</p>
              <div className="space-y-2 rounded-2xl border bg-muted/20 p-4">
                <div className="grid gap-2 sm:grid-cols-4">
                  {['Donors', 'Recipient organizations', 'Volunteers', 'Admins'].map((r) => <div key={r} className="rounded-lg border bg-card p-2 text-center text-sm font-medium text-foreground">{r}</div>)}
                </div>
                <Down />
                <div className="grid gap-2 md:grid-cols-3">
                  <Box tone="accent" title="Next.js web app (Vercel)" items={['Role-based dashboards and donation workflow', 'REST API: session auth, Zod validation, rate limits', 'Audit log of every action']} />
                  <Box tone="accent" title="AI inside the app (TypeScript)" items={['Leftover + waste-risk models (scikit-learn → JSON)', 'Matching model after safety rules', 'Ask FoodLoop: hybrid + graph search', 'AI quick fill, Open-Meteo weather']} />
                  <Box tone="accent" title="Database" items={['SQLite locally, Turso (libSQL) in production', 'Foreign keys, unique constraints, indexes', 'Forecasts stored with model version and inputs']} />
                </div>
                <Down />
                <div className="grid gap-2 md:grid-cols-4">
                  <Box title="ML pipeline (Python)" items={['Jupyter notebooks run by nbclient', 'Time-based split, baselines', 'Exports models + parity cases']} />
                  <Box title="RAG pipeline (Python)" items={['Semantic chunking, LLM contexts', 'sqlite-vec + FTS5, Kùzu graph', 'LangGraph agent, local models']} />
                  <Box title="Analytics" items={['DuckDB star-schema warehouse', 'Delta Lake bronze/silver/gold', 'CSV reports']} />
                  <Box title="Integrations" items={['3 MCP servers (stdio)', 'n8n alert workflow', 'Ollama for local LLMs']} />
                </div>
              </div>
            </Section>

            <Section id="models" icon={BrainCircuit} title="AI models and their results">
              <p>
                Both forecasting models were trained on the Kaggle Food Waste dataset (8,000 real daily records) with a date-based split: the model is
                tested on later days it never saw, the test set was used once, and every score is shown next to a simple baseline.
              </p>
              <Table head={['Model', 'Predicts', 'Result on the test set', 'Baseline']} rows={[
                [`${w.leftover_model} regressor`, 'Units left over at the end of the day', `MAE ${w.mae.toFixed(2)} units · R² ${w.r2} · 80% range covers ${pct(w.interval_80)}`, `MAE ${w.baseline_mae.toFixed(2)} (average)`],
                [`${w.waste_model} classifier`, 'Waste risk: Low / Medium / High', `Accuracy ${pct(w.accuracy)} · macro F1 ${w.f1_macro} · ROC-AUC ${w.roc_auc}`, `${pct(w.baseline_accuracy)} (always "Low")`],
                [`${m.model} classifier`, 'Will an offer to this organization be delivered?', `Accuracy ${pct(m.accuracy)} · precision ${m.precision} · recall ${m.recall} · F1 ${m.f1} · ROC-AUC ${m.roc_auc}`, `${pct(m.baseline_accuracy)} (majority class)`],
              ]} />
              <p>
                The matching model was trained on a clearly labelled <strong>synthetic</strong> dataset (12,424 offers before cleaning), because real delivery
                outcomes do not exist yet. When choosing the single best organization, its pick is delivered successfully {pct(m.top_pick['AI model (top probability)'])} of the time,
                about the same as the rule-based score ({pct(m.top_pick['Rule-based weighted score'])}) and better than the nearest organization
                ({pct(m.top_pick['Nearest organization'])}) or a random eligible one ({pct(m.top_pick['Random eligible organization'])}). It will be retrained on real deliveries.
              </p>
              <p>The models run inside the web app in TypeScript. Automated parity tests check that every prediction equals scikit-learn&apos;s (difference below 0.000001).</p>
            </Section>

            <Section id="assistant" icon={Bot} title="Ask FoodLoop: the AI assistant">
              <p>
                Every role has an assistant that answers from FoodLoop&apos;s own guidelines, policies, help articles, model results and data findings, and from a
                knowledge graph of roles, donation steps and safety rules. It cites its sources and refuses questions the documents do not cover.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <Box title="Retrieval" items={[`Semantic (variable) chunking: ${rag.chunks} chunks, near-duplicates removed`, 'Contextual RAG: each chunk gets a short LLM-written context', 'Vector search in sqlite-vec, keyword search in SQLite FTS5 (BM25)', 'Hybrid: results fused with Reciprocal Rank Fusion']} />
                <Box title="Graph RAG and agent" items={[`Kùzu knowledge graph: ${metrics.graph?.entities} entities, ${metrics.graph?.relationships} relationships`, 'Built from the app\'s own code: roles, status transitions, safety rules', 'LangGraph agent: retrieve → grade → widen once → answer or refuse', 'Cheap-model routing and context trimming for local models']} />
              </div>
              <Table head={['Chunk text', 'Search', 'Right section first (hit@1)', 'In top 3 (hit@3)', 'MRR']}
                rows={rag.retrieval.map((r) => [r.chunks, r.search === 'graph' ? 'hybrid + graph' : r.search, pct(r.hit1, 0), pct(r.hit3, 0), r.mrr.toFixed(3)])} />
              {llms.length > 0 && (
                <Table head={['Local model (Ollama)', 'Correct answers', 'Cites sources', 'Refuses out-of-scope', 'Median time']}
                  rows={llms.map((x) => [x.model, pct(x.answer_accuracy, 0), pct(x.citation_rate, 0), pct(x.refusal_accuracy, 0), `${x.median_seconds}s`])} />
              )}
              <p>
                On the live site the assistant quotes the best sentences, because a server cannot reach a model on someone&apos;s laptop. Run locally with
                Ollama, the same flow writes the answer with Qwen 2.5, Llama 3.2, DeepSeek-R1 or Mistral. The TypeScript search returns exactly the Python results (parity test).
              </p>
            </Section>

            <Section id="data" icon={Database} title="Data pipeline">
              <Table head={['Stage', 'What happens']} rows={[
                ['Sources', 'Kaggle Food Waste dataset (real), synthetic donation-matching dataset (labelled), donor CSV uploads, the app database, Open-Meteo weather'],
                ['Acquisition', 'CSV bulk import with row-by-row validation and preview, AI extraction from free text (structured JSON output), API pull for weather'],
                ['Cleaning', 'Deduplication, text and Yes/No normalisation, mixed date fixes, impossible values set to missing, training-data-only imputation'],
                ['Lakehouse', 'Delta Lake medallion layers: bronze (raw) → silver (clean, typed, MERGE upserts) → gold (aggregates), versioned with schema checks'],
                ['Warehouse', `DuckDB star schema: ${Object.keys(metrics.warehouse?.rows ?? {}).length} tables (facts for inventory waste, donation matches, app donations; 7 dimensions)`],
                ['Serving', 'Dashboards, forecast cards with reasons, ranked match cards, CSV exports, MCP tools'],
              ]} />
              {lake && (
                <Table head={['Delta table', 'Rows', 'Version', 'Partitioned by']}
                  rows={Object.entries(lake).map(([k, v]) => [k, v.rows.toLocaleString('en-US'), v.version, v.partitions.join(', ') || '–'])} />
              )}
              <p>Warehouse finding: {metrics.warehouse?.headline.highest_waste_category.category} has the highest waste rate ({metrics.warehouse?.headline.highest_waste_category.waste_rate_pct}%
                against {metrics.warehouse?.headline.kaggle_waste_rate_pct}% overall). In the synthetic matching data, pickups under 2 km succeed {metrics.warehouse?.headline.success_rate_under_2km_pct}% of the time against {metrics.warehouse?.headline.success_rate_10km_plus_pct}% at 10 km or more.</p>
            </Section>

            <Section id="mcp" icon={PlugZap} title="MCP servers">
              <p>Three Model Context Protocol servers let any AI assistant (Claude Desktop, IDE agents) use FoodLoop without opening the website. They reuse the app&apos;s code, so answers match the site, and every tool is read-only.</p>
              <Table head={['Server', 'Tools']} rows={[
                ['foodloop-forecast-mcp', 'predict_leftover, predict_waste_risk, rank_organizations, get_model_metrics'],
                ['foodloop-knowledge-mcp', 'ask_foodloop, search_knowledge, query_knowledge_graph (Cypher on Kùzu)'],
                ['foodloop-warehouse-mcp', 'list_reports, get_report, run_readonly_query (SQL on DuckDB)'],
              ]} />
            </Section>

            <Section id="automation" icon={GitBranch} title="Automation">
              <p>
                FoodLoop sends events (donation created, deadline close, expired, pickup failed, delivered) to a self-hosted n8n workflow protected by a shared secret.
                For urgent events n8n calls FoodLoop back, so every admin gets an in-app alert and the audit log records it. The ML pipeline runs notebooks
                end-to-end with nbclient, GitHub pushes deploy to Vercel automatically, and end-to-end tests run with Playwright.
              </p>
            </Section>

            <Section id="safety" icon={ShieldCheck} title="Safety, privacy and responsible AI">
              <ul className="grid gap-2 md:grid-cols-2">
                {[
                  'AI never creates or publishes a donation: a person confirms the real quantity and a verified safe-use deadline.',
                  'Safety rules run before any AI ranking; excluded organizations are listed with the reason.',
                  'Every forecast is shown as an estimate with a range, probabilities and plain-language reasons.',
                  'Pickup addresses and phone numbers are shared only after a request is accepted.',
                  'Contact details are removed before text reaches any AI model; no personal data is used for training.',
                  'Hashed passwords, role-based access, login and API rate limits, Zod validation on every input.',
                  'The assistant answers only from FoodLoop documents, cites sources and refuses the rest.',
                  'Synthetic data is labelled everywhere; models are monitored for drift; all actions are audit-logged.',
                ].map((t) => <li key={t} className="rounded-lg border bg-card p-3 text-sm">{t}</li>)}
              </ul>
            </Section>

            <Section id="stack" icon={Boxes} title="Tech stack">
              <div className="flex flex-wrap gap-2">
                {['Next.js 13', 'React', 'TypeScript', 'Tailwind CSS', 'shadcn/ui', 'Recharts', 'Zod', 'SQLite', 'Turso (libSQL)', 'Vercel', 'Python', 'pandas',
                  'scikit-learn', 'XGBoost', 'LightGBM', 'Jupyter + nbclient', 'sqlite-vec', 'SQLite FTS5', 'Kùzu', 'LangGraph', 'Ollama', 'DuckDB', 'Delta Lake',
                  'MCP TypeScript SDK', 'n8n', 'Open-Meteo', 'Playwright'].map((t) => (
                  <span key={t} className="rounded-full border bg-card px-3 py-1 text-sm text-foreground">{t}</span>
                ))}
              </div>
            </Section>

            <Section id="limits" icon={FileSearch} title="Honest limits">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>The leftover model learned typical demand from the Kaggle businesses, not from each restaurant&apos;s own sales yet; a donor&apos;s history pre-fills the quantities.</li>
                <li>The waste-risk model is right about 7 times in 10, because the level depends on how many customers actually come that day.</li>
                <li>The matching model is trained on synthetic data and its top pick is no better than the rule-based score yet; real delivery data will be used to retrain it.</li>
                <li>The live assistant quotes sources instead of writing answers; local models need Ollama on the user&apos;s computer.</li>
              </ul>
            </Section>

            <Section id="try" icon={BarChart3} title="Try it">
              <p>
                Sign in to the live demo with the donor, recipient, volunteer or admin test accounts listed in our submission. Good places to start: the AI Surplus
                Forecast, Create Donation (try Quick fill with AI), a donation&apos;s AI matches, Ask FoodLoop, and the admin AI Model Monitoring page.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild><Link href="/login">Open the live demo <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
                <Button asChild variant="outline"><a href="https://github.com/Galib-272/foodloop" target="_blank" rel="noreferrer"><Network className="h-4 w-4" aria-hidden /> README and code</a></Button>
              </div>
              <p className="text-xs">Metrics on this page are generated from the project&apos;s evaluation reports on {metrics.generated_at.slice(0, 10)}.</p>
            </Section>
          </article>
        </div>
      </main>
      <Footer />
    </>
  );
}
