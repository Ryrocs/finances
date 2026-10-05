import { expect, request, test, type APIRequestContext, type Page } from '@playwright/test';

/**
 * Responsive QA on real pages filled with demo data: no horizontal overflow, nothing wider than
 * the screen, tab bar labels fully visible, sheets fit the viewport — at every required size.
 */
const MOBILE = [
  [320, 667],
  [360, 800],
  [375, 812],
  [390, 844],
  [414, 896],
  [430, 932],
] as const;
const DESKTOP = [
  [1366, 768],
  [1440, 900],
  [1920, 1080],
] as const;
const PAGES = ['/', '/movements', '/analytics', '/net-worth', '/budget', '/settings', '/settings/accounts', '/settings/categories', '/settings/recurring'];

let cookie: { name: string; value: string; domain: string; path: string }[] = [];
let api: APIRequestContext;

test.beforeAll(async ({ baseURL }) => {
  const ctx = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL! } });
  api = ctx;
  const signup = await ctx.post('/api/auth/signup', {
    data: { name: 'Responsive Tester With A Long Name', email: `layout-${Date.now()}@test.local`, password: 'correct horse battery', locale: 'ca' },
  });
  expect(signup.status()).toBe(201);
  expect((await ctx.post('/api/demo')).status()).toBe(200);
  const state = await ctx.storageState();
  cookie = state.cookies.map((c) => ({ name: c.name, value: c.value, domain: c.domain, path: c.path }));
});

async function overflowReport(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const pageOverflow = document.documentElement.scrollWidth - vw;
    const offenders: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('main *, nav *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // Ignore content clipped by an ancestor (e.g. decorative shapes, sr-only).
      let clipped = false;
      for (let p = el.parentElement; p; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (s.overflowX !== 'visible' || s.position === 'fixed') {
          const pr = p.getBoundingClientRect();
          if (pr.right <= vw + 1) clipped = true;
          break;
        }
      }
      if (!clipped && (r.right > vw + 1 || r.left < -1)) offenders.push(`${el.tagName}.${String(el.className).slice(0, 50)}`);
    }
    return { pageOverflow, offenders: offenders.slice(0, 5) };
  });
}

for (const [width, height] of [...MOBILE, ...DESKTOP]) {
  test(`no horizontal overflow at ${width}×${height}`, async ({ browser }) => {
    const isMobile = width < 1024;
    const context = await browser.newContext({ viewport: { width, height }, isMobile, hasTouch: isMobile, locale: 'ca-ES' });
    await context.addCookies(cookie);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    for (const path of PAGES) {
      await page.goto(path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(250);
      const report = await overflowReport(page);
      expect(report.pageOverflow, `${path} page overflow`).toBeLessThanOrEqual(0);
      expect(report.offenders, `${path} elements outside the viewport`).toEqual([]);
    }

    if (isMobile) {
      // Tab bar visible, labels not truncated, sidebar hidden.
      const nav = page.getByRole('navigation', { name: 'Navegació principal' }).last();
      await expect(nav).toBeVisible();
      const truncated = await nav.locator('a span:last-child').evaluateAll((spans) =>
        spans.filter((s) => s.scrollWidth > s.clientWidth + 1).map((s) => s.textContent),
      );
      expect(truncated, 'tab labels must be fully visible').toEqual([]);

      // The add-movement sheet fits the screen and its Save button is reachable.
      await page.goto('/');
      await page.getByRole('button', { name: 'Afegeix un moviment' }).first().click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      const box = await dialog.boundingBox();
      expect(box!.width).toBeLessThanOrEqual(width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(height + 1);
      await expect(dialog.getByRole('button', { name: 'Desa', exact: true })).toBeInViewport();
      const segTruncated = await dialog.locator('[role=radiogroup] label span').evaluateAll((spans) =>
        spans.filter((s) => s.scrollWidth > s.clientWidth + 1).map((s) => s.textContent),
      );
      expect(segTruncated, 'movement type labels must be fully visible').toEqual([]);
      // Touch targets: every button in the sheet is at least 40px tall.
      const small = await dialog.locator('button').evaluateAll((els) =>
        els.filter((e) => e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 40).map((e) => e.textContent || e.getAttribute('aria-label')),
      );
      expect(small, 'touch targets').toEqual([]);
    } else {
      await expect(page.getByRole('complementary', { name: 'Navegació principal' })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Navegació principal' }).last()).toBeHidden();
    }
    expect(errors).toEqual([]);
    await context.close();
  });
}

test('long translated labels fit in Spanish and English at 320px', async ({ browser }) => {
  for (const locale of ['es', 'en'] as const) {
    // The language is a profile setting (it follows the user), so change it there.
    expect((await api.patch('/api/me', { data: { locale } })).status()).toBe(200);
    const context = await browser.newContext({ viewport: { width: 320, height: 667 }, isMobile: true, hasTouch: true });
    await context.addCookies([...cookie, { name: 'fin_locale', value: locale, domain: cookie[0].domain, path: '/' }]);
    const page = await context.newPage();
    for (const path of ['/', '/budget', '/net-worth']) {
      await page.goto(path, { waitUntil: 'networkidle' });
      const report = await overflowReport(page);
      expect(report.pageOverflow, `${locale} ${path}`).toBeLessThanOrEqual(0);
    }
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await context.close();
  }
  await api.patch('/api/me', { data: { locale: 'ca' } });
});
