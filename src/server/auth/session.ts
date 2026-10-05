import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { getDb } from '../db';
import { sessions, users, type UserRow } from '../db/schema';

export const SESSION_COOKIE = 'fin_session';
const SESSION_DAYS = 30;
const RENEW_WHEN_DAYS_LEFT = 15;
const DAY_MS = 86_400_000;

export type SessionUser = Omit<UserRow, 'passwordHash'>;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
  await getDb().insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

/**
 * Validates a raw session token against the database. Extends the session (sliding expiry)
 * when it's past half its lifetime. Returns null for unknown/expired tokens.
 */
export async function validateSessionToken(
  token: string,
): Promise<{ user: SessionUser; expiresAt: Date; renewed: boolean } | null> {
  if (!token || token.length > 200) return null;
  const db = getDb();
  const id = hashToken(token);
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  let expiresAt = row.session.expiresAt;
  let renewed = false;
  if (expiresAt.getTime() - Date.now() < RENEW_WHEN_DAYS_LEFT * DAY_MS) {
    expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));
    renewed = true;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...user } = row.user;
  return { user, expiresAt, renewed };
}

export async function invalidateSession(token: string): Promise<void> {
  await getDb().delete(sessions).where(eq(sessions.id, hashToken(token)));
}

export async function invalidateAllSessions(userId: string): Promise<void> {
  await getDb().delete(sessions).where(eq(sessions.userId, userId));
}

export async function deleteExpiredSessions(): Promise<void> {
  await getDb().delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    expires: expiresAt,
  };
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, '', { ...sessionCookieOptions(new Date(0)), maxAge: 0 });
}

/**
 * Current user for Server Components / Route Handlers, memoised per request.
 * Cookies can't be written during Server Component rendering, so renewal of the cookie
 * expiry happens in Route Handlers (see `requireUser` in http.ts).
 */
export const getSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const result = await validateSessionToken(token);
  return result ? { ...result, token } : null;
});

export async function getCurrentUser(): Promise<SessionUser | null> {
  return (await getSession())?.user ?? null;
}
