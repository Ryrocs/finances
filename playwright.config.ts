import { defineConfig } from '@playwright/test';

/*
 * E2E tests run against a production build (`next build && next start`) — the same code that
 * runs on Vercel — backed by a real Postgres database.
 *   E2E_DATABASE_URL  database for the test server (default: local finances_e2e)
 *   E2E_BASE_URL      test an already running deployment instead (e.g. a Vercel preview URL)
 *   CHROMIUM_PATH     optional browser executable
 */
const PORT = 3100;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const databaseUrl = process.env.E2E_DATABASE_URL ?? 'postgresql://finances:finances@127.0.0.1:5432/finances_e2e';

const mobile = { isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    locale: 'ca-ES',
    timezoneId: 'Europe/Madrid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'mobile-390', use: { viewport: { width: 390, height: 844 }, ...mobile }, testIgnore: /layout\.spec/ },
    { name: 'layout', use: { viewport: { width: 390, height: 844 }, ...mobile }, testMatch: /layout\.spec/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: `${baseURL}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: { DATABASE_URL: databaseUrl, CRON_SECRET: 'e2e-cron-secret', NODE_ENV: 'production' },
      },
});
