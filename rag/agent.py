"""
"Ask FoodSphere" agent built with LangGraph.

    START -> retrieve -> grade --relevant--------> generate -> END
                           |--not relevant, 1st try--> widen -> retrieve (again, more results)
                           |--not relevant, 2nd try--> refuse   -> END

retrieve  hybrid search (sqlite-vec + FTS5, contextual chunks)
grade     are the question's key words actually covered by the retrieved chunks?
generate  a local Ollama model (DeepSeek-R1, Llama 3.2, Qwen 2.5, Mistral) answers ONLY from the sources and cites them [1];
          without Ollama, an extractive answer quotes the best-matching sentences.
refuse    says the knowledge base does not cover the question instead of guessing.

Run: python3 rag/agent.py "How cold must refrigerated food be kept?" --model qwen2.5:1.5b
"""
from __future__ import annotations

import argparse
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from typing_extensions import TypedDict

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import Ollama, tokenize  # noqa: E402
from retrieve import Retriever  # noqa: E402

from langgraph.graph import END, START, StateGraph  # noqa: E402

SYSTEM = """You are Ask FoodSphere, the help assistant of FoodSphere AI, a food rescue platform in Bangladesh.
Answer the question using ONLY the numbered sources. Keep the answer to 1-3 short sentences.
Cite the sources you used like [1] or [2]. If the sources do not contain the answer, say "I don't know based on the FoodSphere documents." Do not invent facts."""

REFUSAL = "I couldn't find this in the FoodSphere AI knowledge base, so I won't guess. Try asking about donations, food safety, roles, the AI models or the platform's data."


class AgentState(TypedDict, total=False):
    question: str
    model: Optional[str]
    k: int
    attempts: int
    hits: List[Dict[str, Any]]
    coverage: float
    relevant: bool
    answer: str
    citations: List[int]
    generator: str
    llm: Dict[str, Any]
    trace: List[str]


def coverage(question: str, hits: List[Dict[str, Any]]) -> float:
    """Share of the question's content words that appear in the top retrieved chunks."""
    q = set(tokenize(question))
    if not q or not hits:
        return 0.0
    seen = set(tokenize(' '.join(h['context'] + ' ' + h['text'] for h in hits[:3])))
    return len(q & seen) / len(q)


def extractive_answer(question: str, hits: List[Dict[str, Any]]) -> tuple:
    q = set(tokenize(question))
    best = []
    for n, h in enumerate(hits[:3], 1):
        for s in re.split(r'(?<=[.!?])\s+|\n+', h['text']):
            s = s.strip(' -*')
            if len(s) > 25:
                best.append((len(q & set(tokenize(s))) + (0.5 if n == 1 else 0), n, s))
    best.sort(key=lambda x: -x[0])
    picked = [b for b in best[:2] if b[0] > 0] or best[:1]
    return ' '.join(f'{s} [{n}]' for _, n, s in picked), sorted({n for _, n, _ in picked})


def build_graph(retriever: Retriever, ollama: Optional[Ollama] = None):
    ollama = ollama or Ollama()

    def retrieve(s: AgentState) -> AgentState:
        hits = retriever.search(s['question'], mode='hybrid', contextual=True, k=s.get('k', 4))
        return {'hits': hits, 'attempts': s.get('attempts', 0) + 1,
                'trace': s.get('trace', []) + [f"retrieve: {len(hits)} chunks (k={s.get('k', 4)})"]}

    def grade(s: AgentState) -> AgentState:
        cov = coverage(s['question'], s['hits'])
        ok = cov >= 0.5
        return {'coverage': round(cov, 2), 'relevant': ok, 'trace': s['trace'] + [f'grade: coverage {cov:.2f} -> {"relevant" if ok else "not relevant"}']}

    def widen(s: AgentState) -> AgentState:
        return {'k': 8, 'trace': s['trace'] + ['widen: search again with more results']}

    def generate(s: AgentState) -> AgentState:
        hits = s['hits']
        model = s.get('model')
        if model and ollama.has(model):
            sources = '\n\n'.join(f"[{i}] ({h['doc_title']} > {h['section']})\n{h['text']}" for i, h in enumerate(hits, 1))
            r = ollama.chat(model, [{'role': 'system', 'content': SYSTEM},
                                    {'role': 'user', 'content': f'Sources:\n{sources}\n\nQuestion: {s["question"]}'}])
            cites = sorted({int(n) for n in re.findall(r'\[(\d+)\]', r['text']) if 0 < int(n) <= len(hits)})
            return {'answer': r['text'], 'citations': cites, 'generator': model, 'llm': r,
                    'trace': s['trace'] + [f"generate: {model} in {r['seconds']}s"]}
        text, cites = extractive_answer(s['question'], hits)
        why = f'{model} not available in Ollama' if model else 'no model requested'
        return {'answer': text, 'citations': cites, 'generator': 'extractive',
                'trace': s['trace'] + [f'generate: extractive ({why})']}

    def refuse(s: AgentState) -> AgentState:
        return {'answer': REFUSAL, 'citations': [], 'generator': 'refusal', 'trace': s['trace'] + ['refuse: not covered']}

    def route(s: AgentState) -> str:
        if s['relevant']:
            return 'generate'
        return 'widen' if s['attempts'] < 2 else 'refuse'

    g = StateGraph(AgentState)
    for name, fn in [('retrieve', retrieve), ('grade', grade), ('widen', widen), ('generate', generate), ('refuse', refuse)]:
        g.add_node(name, fn)
    g.add_edge(START, 'retrieve')
    g.add_edge('retrieve', 'grade')
    g.add_conditional_edges('grade', route, {'generate': 'generate', 'widen': 'widen', 'refuse': 'refuse'})
    g.add_edge('widen', 'retrieve')
    g.add_edge('generate', END)
    g.add_edge('refuse', END)
    return g.compile()


def ask(graph, question: str, model: Optional[str] = None) -> AgentState:
    t0 = time.time()
    out = graph.invoke({'question': question, 'model': model, 'k': 4, 'attempts': 0, 'trace': []})
    out['seconds'] = round(time.time() - t0, 2)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('question', nargs='+')
    ap.add_argument('--model', default=None, help='Ollama model, e.g. qwen2.5:1.5b, llama3.2:1b, deepseek-r1:1.5b, mistral:7b')
    a = ap.parse_args()
    graph = build_graph(Retriever())
    out = ask(graph, ' '.join(a.question), a.model)
    print(f"\n{out['answer']}\n")
    for i, h in enumerate(out.get('hits', []), 1):
        mark = '*' if i in out.get('citations', []) else ' '
        print(f" {mark}[{i}] {h['doc_title']} > {h['section']}")
    print(f"\nanswered by: {out['generator']} | {out['seconds']}s | " + ' -> '.join(out['trace']))


if __name__ == '__main__':
    main()
