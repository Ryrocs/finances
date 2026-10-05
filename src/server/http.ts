import 'server-only';
import type { z } from 'zod';
import { fieldErrors } from '@/lib/validation';
import type { ApiErrorBody, ApiErrorCode } from '@/lib/types';
import { getSession, setSessionCookie, type SessionUser } from './auth/session';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ApiErrorCode,
    public fields?: Record<string, string>,
  ) {
    super(code);
  }
}

export const notFound = () => new ApiError(404, 'not_found');
export const validationError = (fields: Record<string, string>) => new ApiError(400, 'validation', fields);

function pgErrorOf(error: unknown): { code?: string; constraint?: string } | null {
  if (!error || typeof error !== 'object') return null;
  const e = error as { code?: unknown; cause?: unknown };
  if (typeof e.code === 'string' && /^[0-9A-Z]{5}$/.test(e.code)) return error as { code: string };
  return e.cause ? pgErrorOf(e.cause) : null;
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    const body: ApiErrorBody = { error: { code: error.code, ...(error.fields ? { fields: error.fields } : {}) } };
    return Response.json(body, { status: error.status });
  }
  const pg = pgErrorOf(error);
  if (pg?.code === '23505') return Response.json({ error: { code: 'conflict' } } satisfies ApiErrorBody, { status: 409 });
  if (pg?.code === '23503' || pg?.code === '23514' || pg?.code === '22P02') {
    return Response.json({ error: { code: 'validation' } } satisfies ApiErrorBody, { status: 400 });
  }
  console.error('[api] unexpected error', error);
  return Response.json({ error: { code: 'server_error' } } satisfies ApiErrorBody, { status: 500 });
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF defence in depth (cookies are already SameSite=Lax): browsers always send Origin on
 * cross-origin mutating requests, so a present-but-foreign Origin is rejected.
 */
export function assertSameOrigin(req: Request): void {
  if (!MUTATING.has(req.method)) return;
  if (req.headers.get('sec-fetch-site') === 'cross-site') throw new ApiError(403, 'bad_origin');
  const origin = req.headers.get('origin');
  if (!origin) return;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, 'bad_origin');
  }
  if (!host || originHost !== host) throw new ApiError(403, 'bad_origin');
}

export async function readJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.output<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw validationError({ _form: 'invalid' });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw validationError(fieldErrors(parsed.error));
  return parsed.data;
}

export function parseQuery<S extends z.ZodType>(req: Request, schema: S): z.output<S> {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = schema.safeParse(params);
  if (!parsed.success) throw validationError(fieldErrors(parsed.error));
  return parsed.data;
}

type Params = Record<string, string | string[] | undefined>;

interface HandlerArgs<P> {
  req: Request;
  user: SessionUser;
  params: P;
}

/**
 * Wraps an authenticated Route Handler: same-origin check, session validation (from the DB),
 * sliding cookie renewal, JSON serialisation and error mapping. The user id handed to the
 * handler always comes from the session — never from the request.
 */
export function authed<P extends Params = Params>(handler: (args: HandlerArgs<P>) => Promise<unknown>) {
  return async (req: Request, ctx: { params: Promise<P> }): Promise<Response> => {
    try {
      assertSameOrigin(req);
      const session = await getSession();
      if (!session) throw new ApiError(401, 'unauthorized');
      if (session.renewed) await setSessionCookie(session.token, session.expiresAt);
      const result = await handler({ req, user: session.user, params: await ctx.params });
      if (result instanceof Response) return result;
      return Response.json(result ?? { ok: true });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/** Unauthenticated handler (sign-up, login). */
export function publicRoute(handler: (req: Request) => Promise<unknown>) {
  return async (req: Request): Promise<Response> => {
    try {
      assertSameOrigin(req);
      const result = await handler(req);
      if (result instanceof Response) return result;
      return Response.json(result ?? { ok: true });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}
