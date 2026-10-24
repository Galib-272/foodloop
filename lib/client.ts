'use client';

export type ApiErrorBody = { code: string; message: string; fields?: Record<string, string> };

export async function apiFetch<T = Record<string, unknown>>(
  path: string,
  opts: { method?: string; body?: unknown } = {}
): Promise<{ data: T | null; error: ApiErrorBody | null }> {
  try {
    const res = await fetch(path, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        data: null,
        error: json.error ?? { code: 'http_' + res.status, message: 'Request failed. Please try again.' },
      };
    }
    return { data: json as T, error: null };
  } catch {
    return { data: null, error: { code: 'network', message: 'Network error. Check your connection and try again.' } };
  }
}
