import { z } from 'zod';
import { accountUpdateSchema } from '@/lib/validation';
import { authed, notFound, readJson } from '@/server/http';
import { deleteAccount, listAccounts, updateAccount } from '@/server/services/accounts';
import { userToday } from '@/server/services/users';

const idSchema = z.uuid();

export const PATCH = authed<{ id: string }>(async ({ req, user, params }) => {
  if (!idSchema.safeParse(params.id).success) throw notFound();
  const input = await readJson(req, accountUpdateSchema);
  await updateAccount(user.id, params.id, input);
  const accounts = await listAccounts(user.id, userToday(user));
  return { account: accounts.find((a) => a.id === params.id) };
});

export const DELETE = authed<{ id: string }>(async ({ user, params }) => {
  if (!idSchema.safeParse(params.id).success) throw notFound();
  await deleteAccount(user.id, params.id);
  return { ok: true };
});
