import { z } from 'zod';
import { authed, notFound } from '@/server/http';
import { deleteBudget } from '@/server/services/budgets';

export const DELETE = authed<{ id: string }>(async ({ user, params }) => {
  if (!z.uuid().safeParse(params.id).success) throw notFound();
  await deleteBudget(user.id, params.id);
  return { ok: true };
});
