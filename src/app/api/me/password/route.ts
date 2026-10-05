import { createHash } from 'node:crypto';
import { changePasswordSchema } from '@/lib/validation';
import { getSession } from '@/server/auth/session';
import { authed, readJson } from '@/server/http';
import { changePassword } from '@/server/services/users';

export const POST = authed(async ({ req, user }) => {
  const { currentPassword, newPassword } = await readJson(req, changePasswordSchema);
  const session = await getSession();
  const keep = session ? createHash('sha256').update(session.token).digest('hex') : undefined;
  await changePassword(user.id, currentPassword, newPassword, keep);
  return { ok: true };
});
