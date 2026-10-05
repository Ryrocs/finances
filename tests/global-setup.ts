import { execFileSync } from 'node:child_process';

/** Applies migrations to the test database once before the suite (same script Vercel runs). */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://finances:finances@127.0.0.1:5432/finances_test';
  execFileSync(process.execPath, ['scripts/migrate.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url, SKIP_MIGRATIONS: '' },
  });
}
