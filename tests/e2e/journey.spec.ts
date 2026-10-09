import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { addMovement, centsToEur, checkScreen, dbTransactions, eur, goMore, goTab, start } from './helpers';

// Interest of the savings account (TAE 2,5 %, 10.000 € from 9 August, 19 % withholding).
const TIN = 12 * (1.025 ** (1 / 12) - 1);
const AUGUST = Math.round(((1000000 * TIN * 23) / 365) * 0.81);
const SEPTEMBER = Math.round((((1000000 + AUGUST) * TIN * 30) / 365) * 0.81);

const CHECKING = 200000 + 183157 - 2450 - 6000 - 1530 - 50000 - 999 * 2;
const SAVINGS = 1000000 + AUGUST + SEPTEMBER + 50000;

test.use({ serviceWorkers: 'block', acceptDownloads: true });

test('full journey: onboarding, movements, balances, interest, recurring, budget, export, backup and restore', async ({ page }, testInfo) => {
  await start(page);

  // 1. Onboarding with the current account only.
  await expect(page.getByRole('heading', { name: 'Controla els teus diners' })).toBeVisible();
  await checkScreen(page, 'welcome');
  await page.getByRole('button', { name: 'Començar' }).click();
  await expect(page.getByTestId('onboarding-account')).toHaveCount(3);
  await page.getByRole('button', { name: 'Treure aquest compte: Efectiu' }).click();
  await page.getByRole('button', { name: 'Treure aquest compte: Compte remunerat' }).click();
  await page.getByLabel('Saldo inicial', { exact: true }).fill('2.000');
  await page.getByLabel('Data del saldo inicial', { exact: true }).fill('2026-08-01');
  await checkScreen(page, 'onboarding accounts');
  await page.getByTestId('onboarding-finish').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Resum' })).toBeVisible();
  await expect(page.getByTestId('value-wealth')).toHaveText(eur('2.000,00 €'));

  // 2. A savings account with TAE 2,5 % and an initial balance two months ago.
  await goMore(page, 'Comptes');
  await page.getByTestId('new-account').click();
  const sheet = page.getByTestId('account-sheet');
  await sheet.getByLabel('Nom', { exact: true }).fill('Compte remunerat');
  await sheet.getByTestId('account-type-remunerat').click();
  await sheet.getByLabel('Saldo inicial', { exact: true }).fill('10000');
  await sheet.getByLabel('Data del saldo inicial', { exact: true }).fill('2026-08-09');
  await sheet.getByLabel('TAE (%)', { exact: true }).fill('2,5');
  await expect(sheet.getByLabel('Retenció (%)', { exact: true })).toHaveValue('19');
  await checkScreen(page, 'account form');
  await sheet.getByTestId('save-account').click();
  await expect(page.getByTestId('account-row')).toHaveCount(2);

  // 3. A transfer between the two accounts.
  await goTab(page, 'Resum');
  await addMovement(page, { type: 'Transferència', amount: '500', account: 'Compte corrent', to: 'Compte remunerat' });

  // 4. Income and several expenses (the fast path: + → amount → category → save).
  await addMovement(page, { type: 'Ingrés', amount: '1831,57', category: 'Feina', description: 'Nòmina' });
  await addMovement(page, { amount: '24,50', category: 'Restauració' });
  await addMovement(page, { amount: '60', category: 'Alimentació' });
  await addMovement(page, { amount: '15,30', category: 'Transport', account: 'Compte corrent' });

  // 10. A monthly recurring expense that started in the past: the due ones are created at once.
  await page.getByTestId('fab').click();
  const form = page.getByTestId('movement-form');
  await page.keyboard.type('9,99');
  await form.getByTestId('category-chip-Subscripcions').click();
  await form.getByTestId('account-chip-Compte corrent').click();
  await form.getByTestId('movement-date').fill('2026-08-15');
  await form.getByRole('radio', { name: 'Moviment recurrent' }).click();
  await form.getByLabel('Descripció', { exact: true }).fill('Spotify');
  await checkScreen(page, 'recurring form');
  await form.getByTestId('save-movement').click();
  await expect(page.getByText('2 moviments generats')).toBeVisible();

  // 7. Dashboard: income, expenses, balance and savings rate. The transfer counts nowhere.
  await expect(page.getByTestId('value-income')).toHaveText(eur('1.831,57 €'));
  await expect(page.getByTestId('value-expenses')).toHaveText(eur('99,80 €'));
  await expect(page.getByTestId('value-balance')).toHaveText(eur('+1.731,77 €'));
  await expect(page.getByTestId('value-savings')).toContainText('Superàvit');
  await expect(page.getByTestId('value-savings')).toContainText(`Estalvi 94,6${String.fromCharCode(0xa0)}%`);
  await expect(page.getByTestId('balance-message')).toHaveText('Has generat superàvit aquest mes.');
  await expect(page.getByTestId('pace-card')).toBeVisible();
  await expect(page.getByTestId('pace-projected')).toHaveText(eur('343,76 €'));
  await checkScreen(page, 'dashboard');

  // 5. Balances of each account.
  await goMore(page, 'Comptes');
  const balances = page.getByTestId('account-balance');
  await expect(balances.nth(0)).toHaveText(centsToEur(CHECKING));
  await expect(balances.nth(1)).toHaveText(centsToEur(SAVINGS));
  await expect(page.getByTestId('account-row').nth(1)).toContainText('TAE 2,5');
  await checkScreen(page, 'accounts');

  // 6. The transfer is neither income nor expense in Moviments either.
  await goTab(page, 'Moviments');
  await expect(page.getByTestId('summary-income')).toHaveText(eur('+1.831,57 €'));
  await expect(page.getByTestId('summary-expenses')).toHaveText(eur('-99,80 €'));
  await expect(page.getByText('Compte corrent → Compte remunerat')).toBeVisible();
  await expect(page.getByRole('heading', { name: "dv., 9 d'oct." })).toBeVisible();
  await checkScreen(page, 'movements');

  // 9. Interest: one movement per finished month, on its last day.
  await page.getByRole('button', { name: 'Mes anterior' }).click();
  await expect(page.getByTestId('month-selector')).toContainText('Setembre 2026');
  await expect(page.getByText('Interessos setembre 2026')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'dc., 30 de set.' })).toBeVisible();
  await expect(page.getByText('Spotify')).toHaveCount(1);
  await page.getByRole('button', { name: 'Mes anterior' }).click();
  await expect(page.getByText('Interessos agost 2026')).toHaveCount(1);
  await expect(page.getByText('Spotify')).toHaveCount(1);
  await page.getByRole('button', { name: 'Mes següent' }).click();
  await page.getByRole('button', { name: 'Mes següent' }).click();

  // Reopening the app creates no duplicates (interest or recurring).
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Moviments' })).toBeVisible();
  let rows = await dbTransactions(page);
  expect(rows.filter((r) => r.source === 'interest').map((r) => r.date).sort()).toEqual(['2026-08-31', '2026-09-30']);
  expect(rows.filter((r) => r.source === 'interest').map((r) => r.amountCents).sort()).toEqual([AUGUST, SEPTEMBER].sort());
  expect(rows.filter((r) => r.source === 'recurring').map((r) => r.date).sort()).toEqual(['2026-08-15', '2026-09-15']);
  expect(rows).toHaveLength(9);

  // 8. Liquid wealth is the sum of the accounts and the chart doesn't start at 0 €.
  await goTab(page, 'Patrimoni');
  await expect(page.getByTestId('wealth-total')).toHaveText(centsToEur(CHECKING + SAVINGS));
  await expect(page.getByTestId('wealth-account')).toHaveCount(2);
  const chart = page.getByTestId('wealth-chart');
  await expect(chart.locator('.recharts-area-curve')).toBeVisible();
  const ticks = await chart.locator('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value').allTextContents();
  expect(ticks.length).toBeGreaterThan(1);
  expect(ticks[0]).not.toMatch(/^0\s/);
  const firstX = await chart.locator('.recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value').first().textContent();
  expect(firstX).toMatch(/ag|1 ag/);
  await checkScreen(page, 'wealth');

  // 11. Budgets: exceed one, get near the limit with another.
  await goMore(page, 'Pressupost');
  await page.getByTestId('edit-budget').click();
  await page.getByTestId('budget-input-total').fill('1000');
  await page.getByTestId('budget-input-Restauració').fill('20');
  await page.getByTestId('budget-input-Alimentació').fill('70');
  await checkScreen(page, 'budget editor');
  await page.getByTestId('save-budget').click();
  await expect(page.getByTestId('budget-line-Restauració')).toHaveAttribute('data-level', 'over');
  await expect(page.getByTestId('budget-line-Restauració')).toContainText('⚠️ Pressupost superat');
  await expect(page.getByTestId('budget-line-Restauració')).toContainText(`${eur('24,50 €')} / ${eur('20,00 €')}`);
  await expect(page.getByTestId('budget-line-Alimentació')).toContainText('A prop del límit');
  await expect(page.getByTestId('budget-total')).toHaveAttribute('data-level', 'ok');
  await checkScreen(page, 'budget');

  // 12. Charts and totals follow adds, edits and deletes.
  await goTab(page, 'Resum');
  await addMovement(page, { amount: '10', category: 'Oci', description: 'Cinema' });
  await expect(page.getByTestId('value-expenses')).toHaveText(eur('109,80 €'));
  await expect(page.getByTestId('category-list')).toContainText('Oci');
  await goTab(page, 'Moviments');
  await page.getByText('Cinema').click();
  await page.getByRole('button', { name: 'Editar' }).click();
  const edit = page.getByTestId('movement-form');
  await edit.getByLabel('Import', { exact: true }).fill('20');
  await edit.getByTestId('save-movement').click();
  await goTab(page, 'Resum');
  await expect(page.getByTestId('value-expenses')).toHaveText(eur('119,80 €'));
  await goTab(page, 'Anàlisi');
  await expect(page.getByTestId('category-bars')).toContainText('Oci');
  await checkScreen(page, 'analysis');
  await goTab(page, 'Moviments');
  await page.getByText('Cinema').click();
  await page.getByTestId('movement-detail').getByRole('button', { name: 'Eliminar' }).click();
  await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Eliminar' }).click();
  await goTab(page, 'Resum');
  await expect(page.getByTestId('value-expenses')).toHaveText(eur('99,80 €'));
  await expect(page.getByTestId('category-list')).not.toContainText('Oci');

  // Tapping a category opens Moviments filtered by it.
  await page.getByRole('button', { name: 'Veure els moviments de Restauració' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Moviments' })).toBeVisible();
  await expect(page.getByTestId('movement-row')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Treure el filtre .*Restauració/ })).toBeVisible();

  // 13. CSV export.
  await goMore(page, 'Dades');
  await checkScreen(page, 'data');
  const [csvDownload] = await Promise.all([page.waitForEvent('download'), page.getByTestId('csv-export').click()]);
  const csvPath = testInfo.outputPath('moviments.csv');
  await csvDownload.saveAs(csvPath);
  const csv = await readFile(csvPath, 'utf8');
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  const lines = csv.slice(1).trim().split('\r\n');
  expect(lines[0]).toBe('Data;Tipus;Import;Categoria;Compte;Compte destinació;Descripció;Notes');
  expect(lines).toHaveLength(10);
  expect(lines).toContain('2026-10-09;Ingrés;1831,57;Feina;Compte corrent;;Nòmina;');
  expect(lines).toContain('2026-10-09;Transferència;500,00;;Compte corrent;Compte remunerat;;');

  // Backup, wipe everything (double confirmation), restore from the welcome screen.
  const [backupDownload] = await Promise.all([page.waitForEvent('download'), page.getByTestId('backup-export').click()]);
  const backupPath = testInfo.outputPath('copia.json');
  await backupDownload.saveAs(backupPath);
  await expect(page.getByTestId('last-backup')).toHaveText('Última còpia: avui');
  const before = await dbTransactions(page);

  await page.getByTestId('wipe').click();
  await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Sí, esborrar-ho tot' }).click();
  await expect(page.getByRole('heading', { name: 'Controla els teus diners' })).toBeVisible();
  expect(await dbTransactions(page)).toHaveLength(0);

  await page.getByTestId('onboarding-restore-file').setInputFiles(backupPath);
  await expect(page.getByRole('heading', { level: 1, name: 'Resum' })).toBeVisible();
  const restored = await dbTransactions(page);
  const byId = (a: Record<string, unknown>, b: Record<string, unknown>) => String(a.id).localeCompare(String(b.id));
  expect(restored.sort(byId)).toEqual(JSON.parse(JSON.stringify(before)).sort(byId));
  await expect(page.getByTestId('value-income')).toHaveText(eur('1.831,57 €'));
  await expect(page.getByTestId('value-expenses')).toHaveText(eur('99,80 €'));

  // 14. Everything persists across a reload.
  await page.reload();
  await expect(page.getByTestId('value-balance')).toHaveText(eur('+1.731,77 €'));
  await goMore(page, 'Comptes');
  await expect(page.getByTestId('account-balance').nth(0)).toHaveText(centsToEur(CHECKING));
  await expect(page.getByTestId('account-balance').nth(1)).toHaveText(centsToEur(SAVINGS));
  await goMore(page, 'Pressupost');
  await expect(page.getByTestId('budget-line-Restauració')).toHaveAttribute('data-level', 'over');
  await goMore(page, 'Recurrents');
  await expect(page.getByTestId('rule-row')).toContainText('Spotify');
  await expect(page.getByTestId('rule-row')).toContainText("Propera: 15 d'oct.");
  await checkScreen(page, 'recurring');
  await goMore(page, 'Categories');
  await checkScreen(page, 'categories');
  rows = await dbTransactions(page);
  expect(rows).toHaveLength(9);
});

test('validations keep invalid movements out', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Començar' }).click();
  await page.getByTestId('onboarding-finish').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Resum' })).toBeVisible();

  await page.getByTestId('fab').click();
  const form = page.getByTestId('movement-form');
  // Empty amount and no category.
  await form.getByTestId('save-movement').click();
  await expect(form.getByText('Introdueix un import més gran que 0.')).toBeVisible();
  await expect(form.getByText('Tria una categoria.')).toBeVisible();
  // Before the initial balance of the account.
  await form.getByLabel('Import', { exact: true }).fill('5');
  await form.getByTestId('category-chip-Oci').click();
  await form.getByTestId('movement-date').fill('2026-01-01');
  await form.getByTestId('save-movement').click();
  await expect(form.getByText(/La data no pot ser anterior al saldo inicial/)).toBeVisible();
  // A transfer to the same account.
  await form.getByRole('radio', { name: 'Transferència' }).click();
  await form.getByLabel('Import', { exact: true }).fill('5');
  await form.getByRole('button', { name: 'Avui' }).click();
  await form.getByTestId('account-chip-Efectiu').click();
  await form.getByTestId('to-account-chip-Efectiu').click();
  await form.getByTestId('save-movement').click();
  await expect(form.getByText("El compte de destinació ha de ser diferent del d'origen.")).toBeVisible();
  // The save button stays visible above the bottom of the screen.
  const box = await form.getByTestId('save-movement').boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await checkScreen(page, 'form errors');
  await page.keyboard.press('Escape');
  expect(await dbTransactions(page)).toHaveLength(0);
});
