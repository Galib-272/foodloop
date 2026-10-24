import { NextResponse } from 'next/server';
import { ZodError, type ZodSchema } from 'zod';
import { getCurrentUser, type SessionUser } from './auth';
import type { Role } from './constants';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, fields?: Record<string, string>) =>
  new ApiError(400, 'bad_request', msg, fields);
export const forbidden = (msg = 'You do not have permission to perform this action.') =>
  new ApiError(403, 'forbidden', msg);
export const notFound = (msg = 'Not found.') => new ApiError(404, 'not_found', msg);
export const conflict = (msg: string) => new ApiError(409, 'conflict', msg);

/** Consistent JSON error shape: { error: { code, message, fields? } } */
export function errorResponse(e: unknown) {
  if (e instanceof ApiError) {
    return NextResponse.json(
      { error: { code: e.code, message: e.message, fields: e.fields } },
      { status: e.status }
    );
  }
  if (e instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of e.issues) {
      const key = issue.path.join('.') || '_';
      if (!fields[key]) fields[key] = issue.message;
    }
    return NextResponse.json(
      { error: { code: 'validation_error', message: 'Please correct the highlighted fields.', fields } },
      { status: 400 }
    );
  }
  console.error('[api] unexpected error', e);
  return NextResponse.json(
    { error: { code: 'server_error', message: 'Something went wrong. Please try again.' } },
    { status: 500 }
  );
}

export function apiUser(roles?: Role[]): SessionUser {
  const user = getCurrentUser();
  if (!user) throw new ApiError(401, 'unauthenticated', 'Please sign in.');
  if (user.account_status === 'suspended') throw new ApiError(403, 'suspended', 'Your account is suspended.');
  if (roles && !roles.includes(user.role)) throw forbidden();
  return user;
}

export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw badRequest('Request body must be valid JSON.');
  }
  return schema.parse(json);
}

export function handle<C = unknown>(fn: (req: Request, ctx: C) => Promise<unknown> | unknown) {
  return async (req: Request, ctx: C) => {
    try {
      const out = await fn(req, ctx);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

// Simple in-memory fixed-window rate limiter (per process).
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(req: Request, key: string, limit: number, windowMs: number) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'local';
  const k = `${key}:${ip}`;
  const now = Date.now();
  const b = buckets.get(k);
  if (!b || b.reset < now) {
    buckets.set(k, { count: 1, reset: now + windowMs });
    return;
  }
  b.count++;
  if (b.count > limit) {
    throw new ApiError(429, 'rate_limited', 'Too many attempts. Please wait a moment and try again.');
  }
}

export function idParam(v: string | undefined): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw badRequest('Invalid id.');
  return n;
}
