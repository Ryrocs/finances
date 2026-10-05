import { z } from 'zod';
import { transactionSchema } from '@/lib/validation';
import { authed, notFound, readJson } from '@/server/http';
import { deleteTransaction, getTransaction, toTransactionDTO, updateTransaction } from '@/server/services/transactions';

const idSchema = z.uuid();

export const GET = authed<{ id: string }>(async ({ user, params }) => {
  if (!idSchema.safeParse(params.id).success) throw notFound();
  return { transaction: toTransactionDTO(await getTransaction(user.id, params.id)) };
});

export const PUT = authed<{ id: string }>(async ({ req, user, params }) => {
  if (!idSchema.safeParse(params.id).success) throw notFound();
  const input = await readJson(req, transactionSchema);
  return updateTransaction(user.id, params.id, input);
});

export const DELETE = authed<{ id: string }>(async ({ user, params }) => {
  if (!idSchema.safeParse(params.id).success) throw notFound();
  await deleteTransaction(user.id, params.id);
  return { ok: true };
});
