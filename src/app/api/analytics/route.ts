import { z } from 'zod';
import { addMonthsToKey, isValidMonthKey, monthOf } from '@/lib/dates';
import { authed, parseQuery, validationError } from '@/server/http';
import { analytics } from '@/server/services/reports';
import { userToday } from '@/server/services/users';

const month = z.string().refine(isValidMonthKey, { error: 'invalid' });
const querySchema = z.object({ from: month.optional(), to: month.optional() });

export const GET = authed(async ({ req, user }) => {
  const current = monthOf(userToday(user));
  const { to = current, from = addMonthsToKey(to, -11) } = parseQuery(req, querySchema);
  if (from > to || addMonthsToKey(from, 60) < to) throw validationError({ from: 'invalid' });
  return { analytics: await analytics(user.id, from, to) };
});
