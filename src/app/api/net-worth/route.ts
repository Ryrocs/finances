import { z } from 'zod';
import { NET_WORTH_PERIODS } from '@/lib/types';
import { authed, parseQuery } from '@/server/http';
import { netWorth } from '@/server/services/reports';
import { userToday } from '@/server/services/users';

const querySchema = z.object({ period: z.enum(NET_WORTH_PERIODS).optional().default('6m') });

export const GET = authed(async ({ req, user }) => {
  const { period } = parseQuery(req, querySchema);
  return { netWorth: await netWorth(user.id, period, userToday(user)) };
});
