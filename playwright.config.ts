import { defineConfig } from '@playwright/test';

const PORT = 4173;

/**
 * E2E tests against the production build (`npm run build` first), at the two iPhone widths the
 * design targets. The clock is fixed in each test so dates are deterministic.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'ca-ES',
    timezoneId: 'Europe/Madrid',
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'iphone-375', use: { browserName: 'chromium', viewport: { width: 375, height: 812 } } },
    { name: 'iphone-430', use: { browserName: 'chromium', viewport: { width: 430, height: 932 } } },
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
});
