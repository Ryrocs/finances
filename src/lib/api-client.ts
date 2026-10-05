/** Browser-side fetch wrapper for the app's own API (same origin, cookie session). */
import type { ApiErrorBody, ApiErrorCode } from './types';

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: ApiErrorCode | 'network',
    public fields: Record<string, string> = {},
  ) {
    super(code);
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export async function api<T>(path: string, options: { method?: Method; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: options.method ?? 'GET',
      headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: options.signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiClientError(0, 'network');
  }
  if (res.ok) return (await res.json()) as T;

  let body: ApiErrorBody | null = null;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    // non-JSON error (e.g. platform error page)
  }
  const code = body?.error?.code ?? (res.status === 401 ? 'unauthorized' : 'server_error');
  if (code === 'unauthorized' && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload on purpose: drops every cached financial query and re-runs the server auth check
    window.location.assign('/login');
  }
  throw new ApiClientError(res.status, code, body?.error?.fields ?? {});
}

export function qs(params: Record<string, string | number | undefined | null | string[]>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length) sp.set(k, v.join(','));
    } else sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}
