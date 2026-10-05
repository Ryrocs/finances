import type { Locale } from '@/lib/types';
import { deleteAccountSchema, profileSchema } from '@/lib/validation';
import { clearSessionCookie } from '@/server/auth/session';
import { authed, readJson } from '@/server/http';
import { setLocaleCookie } from '@/server/locale';
import { deleteUser, getMe, updateProfile } from '@/server/services/users';

export const GET = authed(async ({ user }) => ({ user: await getMe(user) }));

export const PATCH = authed(async ({ req, user }) => {
  const patch = await readJson(req, profileSchema);
  const updated = await updateProfile(user, patch);
  if (patch.locale) await setLocaleCookie(patch.locale as Locale);
  return { user: await getMe(updated) };
});

/** Permanently deletes the user and all their financial data (password confirmation required). */
export const DELETE = authed(async ({ req, user }) => {
  const { password } = await readJson(req, deleteAccountSchema);
  await deleteUser(user.id, password);
  await clearSessionCookie();
  return { ok: true };
});
