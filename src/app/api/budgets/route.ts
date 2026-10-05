import { z } from 'zod';
import { isValidMonthKey, monthOf } from '@/lib/dates';
import { budgetSchema } from '@/lib/validation';
import { authed, parseQuery, readJson } from '@/server/http';
import { budgetOverview, listBudgets, upsertBudget } from '@/server/services/budgets';
import { userToday } from '@/server/services/users';

const querySchema = z.object({ month: z.string().refine(isValidMonthKey, { error: 'invalid' }).optional() });

export const GET = authed(async ({ req, user }) => {
  const today = userToday(user);
  const { month = monthOf(today) } = parseQuery(req, querySchema);
  const [budgets, overview] = await Promise.all([listBudgets(user.id), budgetOverview(user.id, month, today)]);
  return { budgets, overview };
});

/** Create or replace a budget (categoryId null = overall monthly budget). */
export const PUT = authed(async ({ req, user }) => {
  const input = await readJson(req, budgetSchema);
  return { budget: await upsertBudget(user.id, input) };
});
