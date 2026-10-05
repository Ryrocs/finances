import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db';

/** Deployment check: confirms the function can reach the database. Exposes no data. */
export async function GET() {
  const started = Date.now();
  try {
    const result = await getDb().execute<{ migrated: boolean }>(
      sql`select to_regclass('public.transactions') is not null as migrated`,
    );
    return Response.json({ ok: true, database: 'up', migrated: Boolean(result.rows[0]?.migrated), latencyMs: Date.now() - started });
  } catch {
    return Response.json({ ok: false, database: 'down' }, { status: 503 });
  }
}
