import { expect, test, type Page } from '@playwright/test';
import { start } from './helpers';

test.use({ serviceWorkers: 'block' });

/**
 * Chromium has no on-screen keyboard, so we fake what iOS reports when it opens: the visual
 * viewport shrinks by the keyboard height and, like iOS 26 does, window.innerHeight shrinks too.
 */
async function fakeKeyboard(page: Page) {
  await page.addInitScript(() => {
    // The real layout height, read when needed (at document start it isn't final yet).
    const desc = Object.getOwnPropertyDescriptor(window, 'innerHeight') ?? Object.getOwnPropertyDescriptor(Window.prototype, 'innerHeight');
    const realHeight = () => desc!.get!.call(window) as number;
    let keyboardPx = 0;
    let shrinkInnerHeight = false;
    const visible = () => realHeight() - keyboardPx;
    const vv = new EventTarget();
    const props: Record<string, () => number> = {
      height: visible,
      width: () => document.documentElement.clientWidth,
      offsetTop: () => 0,
      offsetLeft: () => 0,
      pageTop: () => 0,
      pageLeft: () => 0,
      scale: () => 1,
    };
    for (const [key, get] of Object.entries(props)) {
      Object.defineProperty(vv, key, { get });
    }
    Object.defineProperty(window, 'visualViewport', { get: () => vv, configurable: true });
    Object.defineProperty(window, 'innerHeight', { get: () => (shrinkInnerHeight ? visible() : realHeight()), configurable: true });
    (window as unknown as { __keyboard: (px: number, ios26: boolean) => void }).__keyboard = (px, ios26) => {
      keyboardPx = px;
      shrinkInnerHeight = ios26;
      vv.dispatchEvent(new Event('resize'));
    };
  });
}

for (const ios26 of [false, true]) {
  test(`the add-movement sheet stays above the keyboard (${ios26 ? 'innerHeight shrinks, iOS 26' : 'innerHeight fixed, older iOS'})`, async ({ page }) => {
    await fakeKeyboard(page);
    await start(page);
    await page.getByRole('button', { name: 'Començar' }).click();
    await page.getByTestId('onboarding-finish').click();
    await goToMore(page);

    const keyboard = Math.round(page.viewportSize()!.height * 0.45);
    // The tap on "+" opens the keyboard first (focus on the hidden numeric field)…
    await page.getByTestId('fab').click();
    await page.evaluate(([px, flag]) => (window as unknown as { __keyboard: (px: number, f: boolean) => void }).__keyboard(px as number, flag as boolean), [keyboard, ios26]);

    const form = page.getByTestId('movement-form');
    const visibleBottom = page.viewportSize()!.height - keyboard;
    const panel = form.locator('[data-sheet-panel]');
    await expect(async () => {
      const box = (await panel.boundingBox())!;
      // …and the sheet ends exactly where the keyboard starts, fully on screen.
      expect(Math.round(box.y + box.height)).toBeLessThanOrEqual(visibleBottom + 1);
      expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(visibleBottom - 1);
      expect(box.y).toBeGreaterThanOrEqual(0);
    }).toPass({ timeout: 5000 });

    // Title, amount and "Guardar" are all visible above the keyboard.
    for (const locator of [form.getByRole('heading', { name: 'Nou moviment' }), form.getByLabel('Import', { exact: true }), form.getByTestId('save-movement')]) {
      const box = (await locator.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(visibleBottom + 1);
    }
    await expect(form.getByLabel('Import', { exact: true })).toBeFocused();

    // Typing and saving work from there.
    await page.keyboard.type('12,50');
    await form.getByTestId('category-chip-Restauració').click();
    await form.getByTestId('save-movement').click();
    await expect(form).toBeHidden();

    // The keyboard goes away: the next sheet sits at the bottom of the screen again.
    await page.evaluate((flag) => (window as unknown as { __keyboard: (px: number, f: boolean) => void }).__keyboard(0, flag), ios26);
    await page.getByTestId('fab').click();
    await expect(async () => {
      const box = (await page.getByTestId('movement-form').locator('[data-sheet-panel]').boundingBox())!;
      expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(page.viewportSize()!.height - 1);
    }).toPass({ timeout: 5000 });
  });
}

test('even if the browser never reports the keyboard, the top of the form stays above it', async ({ page }) => {
  // Worst case: visualViewport doesn't change at all. The keyboard still covers the bottom ~45 %.
  await start(page);
  await page.getByRole('button', { name: 'Començar' }).click();
  await page.getByTestId('onboarding-finish').click();
  await goToMore(page);
  await page.getByTestId('fab').click();
  const form = page.getByTestId('movement-form');
  const keyboardTop = page.viewportSize()!.height * 0.55;
  const panel = (await form.locator('[data-sheet-panel]').boundingBox())!;
  // The form sheet is anchored to the top of the screen…
  expect(panel.y).toBeLessThanOrEqual(24);
  // …so its title, type selector and amount field are never under the keyboard.
  for (const locator of [form.getByRole('heading', { name: 'Nou moviment' }), form.getByRole('radio', { name: 'Despesa' }), form.getByLabel('Import', { exact: true })]) {
    const box = (await locator.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(keyboardTop);
  }
  await expect(form.getByLabel('Import', { exact: true })).toBeFocused();
});

async function goToMore(page: Page) {
  await page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: 'Més' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Més' })).toBeVisible();
}
