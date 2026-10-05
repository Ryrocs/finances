import 'server-only';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { rateLimits } from '../db/schema';

/**
 * Fixed-window rate limiter stored in Postgres, so it works across serverless instances
 * (memory is not shared between Vercel Function invocations).
 * Returns true when the attempt is allowed.
 */
export async function consumeRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const result = await getDb().execute<{ count: number }>(sql`
    insert into rate_limits (key, count, window_start) values (${key}, 1, now())
    on conflict (key) do update set
      count = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
                   then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
                   then now() else rate_limits.window_start end
    returning count
  `);
  return Number(result.rows[0]?.count ?? 0) <= limit;
}

export async function resetRateLimit(key: string): Promise<void> {
  await getDb().delete(rateLimits).where(eq(rateLimits.key, key));
}
