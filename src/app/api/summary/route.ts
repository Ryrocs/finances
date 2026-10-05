import { z } from 'zod';
import { isValidMonthKey, monthOf } from '@/lib/dates';
import { authed, parseQuery } from '@/server/http';
import { generateDueForUser } from '@/server/services/recurring';
import { monthSummary } from '@/server/services/reports';
import { userToday } from '@/server/services/users';

const querySchema = z.object({ month: z.string().refine(isValidMonthKey, { error: 'invalid' }).optional() });

export const GET = authed(async ({ req, user }) => {
  const today = userToday(user);
  const { month = monthOf(today) } = parseQuery(req, querySchema);
  // Lazy catch-up of recurring movements (idempotent) so the dashboard is always current.
  await generateDueForUser(user.id, today);
  return { summary: await monthSummary(user.id, month, today) };
});
