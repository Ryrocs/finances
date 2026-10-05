import 'server-only';
import { attachDatabasePool } from '@vercel/functions';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

type Global = typeof globalThis & { __financesPool?: Pool; __financesDb?: Database };
const g = globalThis as Global;

function createPool(): Pool {
  // DATABASE_URL is what the Neon integration adds; POSTGRES_URL covers older/renamed setups.
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. See README.md → Environment variables.');
  }
  const pool = new Pool({
    connectionString,
    // Small pool: each function instance handles few concurrent requests and Neon's pooled
    // endpoint (PgBouncer) multiplexes connections server-side.
    max: 5,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
  });
  // Lets Vercel Fluid compute close idle clients before an instance is suspended.
  attachDatabasePool(pool);
  return pool;
}

/** Lazily created so `next build` never needs a database connection. */
export function getDb(): Database {
  if (!g.__financesDb) {
    g.__financesPool = g.__financesPool ?? createPool();
    g.__financesDb = drizzle(g.__financesPool, { schema });
  }
  return g.__financesDb;
}

export { schema };
