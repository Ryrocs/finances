import { z } from 'zod';
import { isValidISODate, isValidMonthKey } from '@/lib/dates';
import { TRANSACTION_TYPES } from '@/lib/types';
import { transactionSchema } from '@/lib/validation';
import { authed, parseQuery, readJson } from '@/server/http';
import { createTransaction, listTransactions } from '@/server/services/transactions';

const querySchema = z.object({
  month: z.string().refine(isValidMonthKey, { error: 'invalid' }).optional(),
  from: z.string().refine(isValidISODate, { error: 'invalid_date' }).optional(),
  to: z.string().refine(isValidISODate, { error: 'invalid_date' }).optional(),
  type: z.enum(TRANSACTION_TYPES).optional(),
  accountId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
  q: z.string().max(100).optional(),
  cats: z
    .string()
    .max(4000)
    .optional()
    .transform((v) => (v ? v.split(',').filter((id) => z.uuid().safeParse(id).success) : [])),
  cursor: z.string().max(300).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const GET = authed(async ({ req, user }) => {
  const { cats, ...filters } = parseQuery(req, querySchema);
  return listTransactions(user.id, { ...filters, matchCategoryIds: cats });
});

export const POST = authed(async ({ req, user }) => {
  const input = await readJson(req, transactionSchema);
  return Response.json(await createTransaction(user.id, input), { status: 201 });
});
