import { recurringSchema } from '@/lib/validation';
import { authed, readJson } from '@/server/http';
import { createRecurring, listRecurring } from '@/server/services/recurring';
import { userToday } from '@/server/services/users';

export const GET = authed(async ({ user }) => ({ recurring: await listRecurring(user.id) }));

export const POST = authed(async ({ req, user }) => {
  const input = await readJson(req, recurringSchema);
  return Response.json({ recurring: await createRecurring(user.id, input, userToday(user)) }, { status: 201 });
});
