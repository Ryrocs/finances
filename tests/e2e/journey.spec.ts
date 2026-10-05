import { expect, test, type Page } from '@playwright/test';

/**
 * The complete user journey on a phone, in the order requested:
 * sign up → account → income → expense → transfer → balances → net worth → budget →
 * exceed budget → edit → delete → switch language → reload → log out → log in → data remains.
 */
test.describe.configure({ mode: 'serial' });

const email = `e2e-${Date.now()}@test.local`;
const password = 'correct horse battery staple';

/** Bottom tab bar link (phones). */
function tab(page: Page, name: string) {
  return page.locator('nav').last().getByRole('link', { name, exact: true });
}

async function openAddMovement(page: Page, name = 'Afegeix un moviment') {
  await page.getByRole('button', { name }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

async function fillMovement(
  page: Page,
  opts: { type?: string; amount: string; category?: string; account?: RegExp; from?: RegExp; to?: RegExp; description?: string },
) {
  const dialog = page.getByRole('dialog');
  if (opts.type) await dialog.getByText(opts.type, { exact: true }).click();
  await dialog.getByLabel(/^(Import|Amount)$/).fill(opts.amount);
  if (opts.category) await dialog.getByText(opts.category, { exact: true }).click();
  if (opts.account) await dialog.getByRole('radiogroup', { name: /^(Compte|Account)$/ }).getByRole('radio', { name: opts.account }).check({ force: true });
  if (opts.from) await dialog.getByRole('radiogroup', { name: 'Des de' }).getByRole('radio', { name: opts.from }).check({ force: true });
  if (opts.to) await dialog.getByRole('radiogroup', { name: 'Cap a' }).getByRole('radio', { name: opts.to }).check({ force: true });
  if (opts.description) await dialog.getByLabel(/Descripció/).fill(opts.description);
  await dialog.getByRole('button', { name: /^(Desa|Save)$/ }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

test('full journey on a phone', async ({ page }) => {
  // 1. Sign up (Catalan is the default language)
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ca');
  await page.getByRole('link', { name: 'Registra’t' }).click();
  await page.getByLabel(/^Nom/).fill('Laia');
  await page.getByLabel('Correu electrònic').fill(email);
  await page.getByLabel('Contrasenya', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Crea el compte' }).click();
  await expect(page.getByRole('heading', { name: 'Hola, Laia' })).toBeVisible();

  // 2. Create accounts
  await page.getByRole('button', { name: 'Afegeix el meu primer compte' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nom').fill('Compte corrent');
  await dialog.getByLabel('Saldo inicial').fill('5000');
  await dialog.getByRole('button', { name: 'Desa' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Patrimoni líquid')).toBeVisible();

  await tab(page, 'Patrimoni').click();
  await page.getByRole('button', { name: 'Afegeix un compte' }).last().click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nom').fill('Estalvi');
  await dialog.getByText('Compte d’estalvi').click();
  await dialog.getByRole('button', { name: 'Desa' }).click();
  await expect(dialog).toBeHidden();

  // 3. Income, 4. expense, 5. transfer — via the floating "+" button
  await openAddMovement(page);
  await fillMovement(page, { type: 'Ingrés', amount: '1500', category: 'Nòmina', account: /Compte corrent/ });
  await openAddMovement(page);
  await fillMovement(page, { amount: '20', category: 'Alimentació', account: /Compte corrent/, description: 'Supermercat' });
  await openAddMovement(page);
  await fillMovement(page, { type: 'Transferència', amount: '1000', from: /Compte corrent/, to: /Estalvi/ });

  // 6. Account balances and 7. liquid net worth (transfer leaves the total unchanged)
  await page.reload();
  const accounts = page.getByRole('list').filter({ hasText: 'Estalvi' });
  await expect(accounts.getByRole('button', { name: /Compte corrent.*5\.480,00/ })).toBeVisible();
  await expect(accounts.getByRole('button', { name: /Estalvi.*1\.000,00/ })).toBeVisible();
  await expect(page.getByText('6.480,00 €').first()).toBeVisible();

  // Dashboard numbers
  await tab(page, 'Inici').click();
  await expect(page.getByText('+1.480,00 €')).toBeVisible(); // 1,500 − 20
  await expect(page.getByText('1.500,00 €').first()).toBeVisible();

  // 8. Budget: Restaurants €80
  await tab(page, 'Pressupost').click();
  await page.getByRole('button', { name: 'Afegeix un pressupost de categoria' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Categoria').selectOption({ label: 'Restaurants' });
  await dialog.getByLabel('Límit mensual').fill('80');
  await dialog.getByRole('button', { name: 'Desa' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Queden 80,00 €')).toBeVisible();

  // 9. Exceed the budget — never blocked, but warned
  await openAddMovement(page);
  await fillMovement(page, { amount: '85,50', category: 'Restaurants', account: /Compte corrent/ });
  await expect(page.getByText(/Restaurants: pressupost superat/)).toBeVisible();
  await expect(page.getByText('Superat en 5,50 €')).toBeVisible();
  await expect(page.getByText('Pressupost superat').first()).toBeVisible();

  // 10. Edit a movement (€20 → €25)
  await tab(page, 'Moviments').click();
  await page.getByRole('button', { name: /Supermercat/ }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Edita el moviment' })).toBeVisible();
  await dialog.getByLabel('Import').fill('25');
  await dialog.getByRole('button', { name: 'Desa' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: /Supermercat.*−25,00/ })).toBeVisible();

  // 11. Delete it
  await page.getByRole('button', { name: /Supermercat/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Elimina' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Elimina' }).click();
  await expect(page.getByRole('button', { name: /Supermercat/ })).toHaveCount(0);

  // Search works
  await page.getByPlaceholder(/Cerca/).fill('restaur');
  await expect(page.getByRole('button', { name: /Restaurants.*−85,50/ })).toBeVisible();

  // 12. Switch language
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  // 13. Reload: language and data persist
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.goto('/net-worth');
  await expect(page.getByRole('heading', { name: 'Net worth' })).toBeVisible();
  await expect(page.getByText('€6,414.50').first()).toBeVisible(); // 5,000 + 1,500 − 85.50 (the €20 expense was deleted)

  // 14. Log out
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/movements');
  await expect(page).toHaveURL(/\/login$/);

  // 15. Log in again (new session) → 16. data remains
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('heading', { name: 'Hi, Laia' })).toBeVisible();
  await tab(page, 'Movements').click();
  await expect(page.getByRole('button', { name: /Restaurants.*−€85.50/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Salary.*\+€1,500.00/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Transfer.*€1,000.00/ })).toBeVisible();
});

test('a brand-new browser context (closed and reopened browser) still sees the data after logging in', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel(/Correu electrònic|Email/).fill(email);
  await page.getByLabel(/^(Contrasenya|Password)$/).fill(password);
  await page.getByRole('button', { name: /Inicia la sessió|Log in/ }).click();
  // Language preference is stored in the profile and follows the user to a new device.
  await expect(page.getByRole('heading', { name: 'Hi, Laia' })).toBeVisible();
  await page.goto('/net-worth');
  await expect(page.getByText('€6,414.50').first()).toBeVisible();
  await context.close();
});

test('wrong password shows a translated error and does not log in', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Correu electrònic').fill(email);
  await page.getByLabel('Contrasenya', { exact: true }).fill('not the password');
  await page.getByRole('button', { name: 'Inicia la sessió' }).click();
  await expect(page.getByText('El correu o la contrasenya no són correctes.')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
