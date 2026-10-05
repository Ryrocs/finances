import pg from 'pg';

/**
 * Local runs only: every run signs up several users from the same IP, which would trip the
 * (intended) sign-up rate limit of the test database across repeated runs. Reset it first.
 */
export default async function globalSetup() {
  if (process.env.E2E_BASE_URL) return;
  const client = new pg.Client({ connectionString: process.env.E2E_DATABASE_URL ?? 'postgresql://finances:finances@127.0.0.1:5432/finances_e2e' });
  await client.connect();
  try {
    await client.query("delete from rate_limits where key like 'signup:%' or key like 'login%'");
  } finally {
    await client.end();
  }
}
