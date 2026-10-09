import { expect, test } from '@playwright/test';
import { centsToEur, checkScreen, eur, goMore, goTab, start } from './helpers';

test.use({ serviceWorkers: 'block' });

test('onboarding with two savings accounts with different balances and TAE', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Començar' }).click();
  const cards = page.getByTestId('onboarding-account');
  await expect(cards).toHaveCount(3);

  // Suggested accounts: current 1.500 €, savings 10.000 € at 2,5 %, no cash.
  await cards.nth(0).getByLabel('Saldo inicial', { exact: true }).fill('1.500');
  await cards.nth(1).getByLabel('Nom', { exact: true }).fill('Trade Republic');
  await cards.nth(1).getByLabel('Saldo inicial', { exact: true }).fill('10000');
  await cards.nth(1).getByLabel('TAE (%)', { exact: true }).fill('2,5');
  await page.getByRole('button', { name: 'Treure aquest compte: Efectiu' }).click();

  // A second savings account in one tap: it comes already marked as "Remunerat".
  await page.getByTestId('onboarding-add-remunerat').click();
  await expect(cards).toHaveCount(3);
  const second = cards.nth(2);
  await expect(second.getByLabel('Nom', { exact: true })).toHaveValue('Compte remunerat');
  await expect(second.getByTestId('account-type-remunerat')).toHaveAttribute('aria-checked', 'true');
  await expect(second.getByLabel('Retenció (%)', { exact: true })).toHaveValue('19');
  await second.getByLabel('Nom', { exact: true }).fill('MyInvestor');
  await second.getByLabel('Saldo inicial', { exact: true }).fill('4.250,50');
  await second.getByLabel('TAE (%)', { exact: true }).fill('3');

  // Any account can still change type with one tap.
  await page.getByTestId('onboarding-add-corrent').click();
  await expect(cards).toHaveCount(4);
  await expect(cards.nth(3).getByLabel('Nom', { exact: true })).toHaveValue('Compte corrent 2');
  await expect(cards.nth(3).getByLabel('TAE (%)', { exact: true })).toHaveCount(0);
  await cards.nth(3).getByTestId('account-type-remunerat').click();
  await expect(cards.nth(3).getByLabel('TAE (%)', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Treure aquest compte: Compte corrent 2' }).click();
  await expect(cards).toHaveCount(3);

  // The total of what was typed, live.
  await expect(page.getByTestId('onboarding-total')).toContainText('3 comptes');
  await expect(page.getByTestId('onboarding-total')).toContainText(eur('15.750,50 €'));
  await checkScreen(page, 'onboarding with two savings accounts');
  await page.getByTestId('onboarding-finish').click();

  await expect(page.getByTestId('value-wealth')).toHaveText(eur('15.750,50 €'));
  await goMore(page, 'Comptes');
  const rows = page.getByTestId('account-row');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(1)).toContainText('Trade Republic');
  await expect(rows.nth(1)).toContainText('Remunerat · TAE 2,5');
  await expect(rows.nth(2)).toContainText('MyInvestor');
  await expect(rows.nth(2)).toContainText('Remunerat · TAE 3');
  await expect(page.getByTestId('account-balance').nth(2)).toHaveText(centsToEur(425050));
  await goTab(page, 'Patrimoni');
  await expect(page.getByTestId('wealth-account')).toHaveCount(3);
  await expect(page.getByTestId('wealth-total')).toHaveText(eur('15.750,50 €'));
});
