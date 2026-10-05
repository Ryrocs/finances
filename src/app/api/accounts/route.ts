import { accountSchema } from '@/lib/validation';
import { authed, readJson } from '@/server/http';
import { createAccount, listAccounts } from '@/server/services/accounts';
import { userToday } from '@/server/services/users';

export const GET = authed(async ({ user }) => ({ accounts: await listAccounts(user.id, userToday(user)) }));

export const POST = authed(async ({ req, user }) => {
  const input = await readJson(req, accountSchema);
  const row = await createAccount(user.id, user.currency, input);
  const accounts = await listAccounts(user.id, userToday(user));
  return Response.json({ account: accounts.find((a) => a.id === row.id) }, { status: 201 });
});
