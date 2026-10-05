import type { Locale } from '@/lib/types';
import { loginSchema } from '@/lib/validation';
import { getDummyHash, verifyPassword } from '@/server/auth/password';
import { consumeRateLimit, resetRateLimit } from '@/server/auth/rate-limit';
import { createSession, setSessionCookie } from '@/server/auth/session';
import { ApiError, clientIp, publicRoute, readJson } from '@/server/http';
import { setLocaleCookie } from '@/server/locale';
import { findUserByEmail, getMe } from '@/server/services/users';

export const POST = publicRoute(async (req) => {
  const { email, password } = await readJson(req, loginSchema);
  const emailKey = `login:${email}`;
  const ipAllowed = await consumeRateLimit(`login-ip:${clientIp(req)}`, 60, 900);
  const emailAllowed = await consumeRateLimit(emailKey, 10, 900);
  if (!ipAllowed || !emailAllowed) throw new ApiError(429, 'rate_limited');

  const row = await findUserByEmail(email);
  // Always run scrypt so response time doesn't reveal whether the email exists.
  const valid = await verifyPassword(password, row?.passwordHash ?? (await getDummyHash()));
  if (!row || !valid) throw new ApiError(401, 'invalid_credentials');

  await resetRateLimit(emailKey);
  const session = await createSession(row.id);
  await setSessionCookie(session.token, session.expiresAt);
  await setLocaleCookie(row.locale as Locale);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...user } = row;
  return { user: await getMe(user) };
});
