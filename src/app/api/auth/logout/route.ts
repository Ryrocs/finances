import { cookies } from 'next/headers';
import { clearSessionCookie, invalidateSession, SESSION_COOKIE } from '@/server/auth/session';
import { publicRoute } from '@/server/http';

export const POST = publicRoute(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await invalidateSession(token);
  await clearSessionCookie();
  return { ok: true };
});
