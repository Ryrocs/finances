import { signupSchema } from '@/lib/validation';
import { consumeRateLimit } from '@/server/auth/rate-limit';
import { createSession, setSessionCookie } from '@/server/auth/session';
import { ApiError, clientIp, publicRoute, readJson } from '@/server/http';
import { getRequestLocale, setLocaleCookie } from '@/server/locale';
import { createUser, getMe } from '@/server/services/users';

export const POST = publicRoute(async (req) => {
  const input = await readJson(req, signupSchema);
  if (!(await consumeRateLimit(`signup:${clientIp(req)}`, 20, 3600))) throw new ApiError(429, 'rate_limited');
  const locale = input.locale ?? (await getRequestLocale());
  const user = await createUser({ ...input, locale });
  const session = await createSession(user.id);
  await setSessionCookie(session.token, session.expiresAt);
  await setLocaleCookie(locale);
  return Response.json({ user: await getMe(user) }, { status: 201 });
});
