'use client';

import { useRef, useState } from 'react';
import { BookOpen, ChevronDown, Loader2, SendHorizontal, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/client';
import { cn } from '@/lib/utils';

type Hit = {
  id: number; doc: string; docTitle: string; section: string; text: string; context: string; contextSource: string;
  score: number; vectorRank: number | null; keywordRank: number | null;
};
type Result = { question: string; answer: string; citations: number[]; generator: string; hits: Hit[]; coverage: number; trace: string[]; ms: number };
type Turn = { q: string; r?: Result; error?: string };

function generatorLabel(g: string) {
  if (g === 'extractive') return 'Quoted from the sources';
  if (g === 'refusal') return 'Not covered by the documents';
  return `Written by ${g} (local model)`;
}

function Answer({ r }: { r: Result }) {
  const [open, setOpen] = useState(false);
  const parts = r.answer.split(/(\[\d+\])/g);
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="whitespace-pre-line text-sm leading-relaxed">
        {parts.map((p, i) =>
          /^\[\d+\]$/.test(p) ? (
            <span key={i} className="mx-0.5 rounded bg-accent px-1 text-xs font-semibold text-primary">{p}</span>
          ) : (
            <span key={i}>{p}</span>
          )
        )}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium',
          r.generator === 'refusal' ? 'bg-amber-100 text-amber-800' : 'bg-accent text-primary')}>
          <Sparkles className="h-3 w-3" aria-hidden /> {generatorLabel(r.generator)}
        </span>
        <span>Hybrid search · {r.hits.length} sources · {r.ms} ms</span>
        {r.hits.length > 0 && (
          <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 font-medium text-secondary hover:underline" aria-expanded={open}>
            <BookOpen className="h-3.5 w-3.5" aria-hidden /> {open ? 'Hide sources' : 'Show sources'}
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
          </button>
        )}
      </div>
      {open && (
        <ol className="mt-3 space-y-2">
          {r.hits.map((h, i) => (
            <li key={h.id} className={cn('rounded-lg border p-3 text-sm', r.citations.includes(i + 1) && 'border-secondary/50 bg-accent/40')}>
              <p className="font-medium">[{i + 1}] {h.docTitle} <span className="text-muted-foreground">› {h.section}</span></p>
              <p className="mt-1 line-clamp-4 text-muted-foreground">{h.text}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Vector rank {h.vectorRank ?? '–'} · keyword rank {h.keywordRank ?? '–'} · fused score {h.score.toFixed(4)}
              </p>
              <p className="mt-1 text-xs italic text-muted-foreground">Context: {h.context}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function AssistantChat({ suggestions, chunks }: { suggestions: string[]; chunks: number }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function send(question: string) {
    const text = question.trim();
    if (text.length < 3 || loading) return;
    setQ('');
    setLoading(true);
    setTurns((t) => [...t, { q: text }]);
    const { data, error } = await apiFetch<Result>('/api/assistant', { body: { question: text } });
    setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, r: data ?? undefined, error: error ? (error.fields?.question ?? error.message) : undefined } : x)));
    setLoading(false);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50);
  }

  return (
    <div className="space-y-5">
      {turns.length === 0 && (
        <div className="rounded-xl border bg-card p-5">
          <p className="text-sm font-medium">Try a question</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s} type="button" onClick={() => send(s)}
                className="rounded-full border px-3 py-1.5 text-left text-sm transition-colors hover:border-secondary hover:bg-accent">
                {s}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Searches {chunks} passages from the FoodSphere knowledge base with hybrid (meaning + keyword) search.</p>
        </div>
      )}
      {turns.map((t, i) => (
        <div key={i} className="space-y-2">
          <div className="ml-auto w-fit max-w-[85%] rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground">{t.q}</div>
          {t.r && <Answer r={t.r} />}
          {t.error && <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{t.error}</p>}
          {!t.r && !t.error && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Searching the knowledge base…</p>
          )}
        </div>
      ))}
      <div ref={endRef} />
      <form onSubmit={(e) => { e.preventDefault(); send(q); }} className="sticky bottom-4 flex items-end gap-2 rounded-xl border bg-card p-2 shadow-sm">
        <label htmlFor="assistant-q" className="sr-only">Your question</label>
        <Textarea id="assistant-q" value={q} onChange={(e) => setQ(e.target.value)} rows={1} maxLength={500}
          placeholder="Ask about donations, food safety, your role or the AI models…" className="min-h-[44px] resize-none border-0 shadow-none focus-visible:ring-0"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(q); } }} />
        <Button type="submit" disabled={loading || q.trim().length < 3} aria-label="Send question">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <SendHorizontal className="h-4 w-4" aria-hidden />}
        </Button>
      </form>
    </div>
  );
}
