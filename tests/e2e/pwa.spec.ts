import { expect, test } from '@playwright/test';
import { start } from './helpers';

test('installable PWA: manifest, iPhone meta tags and icons', async ({ page, request }) => {
  await start(page);
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ name: 'Finances', short_name: 'Finances', display: 'standalone', theme_color: '#ffffff', background_color: '#ffffff', lang: 'ca' });
  expect(manifest.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes} ${i.purpose}`)).toEqual(['192x192 any', '512x512 any', '512x512 maskable']);
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  expect((await request.get('/icons/apple-touch-icon.png')).ok()).toBe(true);

  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
  await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute('content', /.+/);
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('sizes', '180x180');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ca');
});

test('works offline once loaded, keeping the data', async ({ page, context }) => {
  await start(page);
  await page.getByRole('button', { name: 'Començar' }).click();
  await page.getByLabel('Saldo inicial', { exact: true }).first().fill('321');
  await page.getByTestId('onboarding-finish').click();
  await expect(page.getByTestId('value-wealth')).toHaveText(/321,00/);
  // Wait for the service worker to precache the app and take control.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
    }
  });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('value-wealth')).toHaveText(/321,00/);
  // Deep links work offline too (SPA fallback from the service worker).
  await page.goto('/patrimoni');
  await expect(page.getByTestId('wealth-total')).toHaveText(/321,00/);
  await context.setOffline(false);
});
