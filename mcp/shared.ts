/* Shared helpers for the FoodLoop MCP servers (stdio transport). */
import { spawnSync } from 'child_process';
import path from 'path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ZodTypeAny } from 'zod';

/** The project root. The servers chdir here so the model files, knowledge index and databases resolve like in the web app. */
export const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);

/** stdout is the MCP channel, so anything human-readable must go to stderr. */
export const log = (...a: unknown[]) => console.error('[foodloop-mcp]', ...a);

export function json(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }], structuredContent: data as Record<string, unknown> };
}

export function fail(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

/** Run one of the project's read-only Python helpers (uses .venv when present) and parse its JSON output. */
export function runPython(script: string, payload: unknown): { ok: boolean; data?: unknown; error?: string } {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'py.mjs'), script, JSON.stringify(payload)], {
    cwd: ROOT, encoding: 'utf8', timeout: 30_000, maxBuffer: 10 * 1024 * 1024,
  });
  const out = (r.stdout ?? '').trim().split('\n').pop() ?? '';
  try {
    const parsed = JSON.parse(out) as { ok: boolean; error?: string };
    return parsed.ok ? { ok: true, data: parsed } : { ok: false, error: parsed.error };
  } catch {
    return { ok: false, error: (r.stderr || r.error?.message || 'Python helper failed').toString().slice(-500) };
  }
}

/** Tiny CSV parser (quoted fields supported) for the warehouse reports. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; } else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else if (ch !== '\r') cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

type ToolConfig = { title: string; description: string; inputSchema?: Record<string, ZodTypeAny>; annotations?: Record<string, boolean> };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (args: any) => Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean; structuredContent?: Record<string, unknown> }>;

/** registerTool without the SDK's deep generic inference (it overflows TypeScript); zod still validates every input at runtime. */
export function tools(server: McpServer) {
  return (name: string, config: ToolConfig, handler: Handler) =>
    (server.registerTool.bind(server) as unknown as (n: string, c: ToolConfig, h: Handler) => unknown)(name, config, handler);
}
