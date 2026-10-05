import { z } from 'zod';
import type { Locale } from '@/lib/types';
import { authed, parseQuery } from '@/server/http';
import { exportCsv, exportJson } from '@/server/services/export';
import { userToday } from '@/server/services/users';

const querySchema = z.object({ format: z.enum(['csv', 'json']).optional().default('csv') });

export const GET = authed(async ({ req, user }) => {
  const { format } = parseQuery(req, querySchema);
  const stamp = userToday(user);
  if (format === 'json') {
    return new Response(JSON.stringify(await exportJson(user.id), null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="finances-${stamp}.json"`,
      },
    });
  }
  return new Response(await exportCsv(user.id, user.locale as Locale), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="finances-${stamp}.csv"`,
    },
  });
});
