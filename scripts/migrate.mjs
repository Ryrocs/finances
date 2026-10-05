// Applies pending SQL migrations from ./drizzle to the database.
//
// Runs on every Vercel build (`npm run vercel-build`) and can be run manually with
// `npm run db:migrate`. A Postgres advisory lock makes concurrent builds safe: the
// second build waits, then finds nothing left to apply.
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(file);
  } catch {
    // optional file
  }
}

if (process.env.SKIP_MIGRATIONS === '1') {
  console.log('[migrate] SKIP_MIGRATIONS=1, skipping.');
  process.exit(0);
}

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error(
    '[migrate] DATABASE_URL is not set. Connect a Neon Postgres database to this Vercel project ' +
      '(Storage → Neon) or add DATABASE_URL to the environment variables. See README.md.',
  );
  process.exit(1);
}

const LOCK_ID = 7_272_741;
const client = new pg.Client({ connectionString: url });

try {
  await client.connect();
  await client.query('select pg_advisory_lock($1)', [LOCK_ID]);
  try {
    await migrate(drizzle(client), { migrationsFolder: './drizzle' });
    console.log('[migrate] Database schema is up to date.');
  } finally {
    await client.query('select pg_advisory_unlock($1)', [LOCK_ID]);
  }
} catch (error) {
  console.error('[migrate] Migration failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
