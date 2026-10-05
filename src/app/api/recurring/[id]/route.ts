import { z } from 'zod';
import { recurringSchema } from '@/lib/validation';
import { authed, notFound, readJson } from '@/server/http';
import { deleteRecurring, updateRecurring } from '@/server/services/recurring';
import { userToday } from '@/server/services/users';

const idSchema = z.uuid();

export const PUT = authed<{ id: string }>(async ({ req, user, params }) => {
  if (!idSchema.safeParse(params.id).success) throw notFound();
  const input = await readJson(req, recurringSchema);
  return { recurring: await updateRecurring(user.id, params.id, input, userToday(user)) };
});

export const DELETE = authed<{ id: string }>(async ({ user, params }) => {
  if (!idSchema.safeParse(params.id).success) throw notFound();
  await deleteRecurring(user.id, params.id);
  return { ok: true };
});
