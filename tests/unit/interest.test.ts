import { beforeEach, describe, expect, it } from 'vitest';
import { runAutomation } from '../../src/db/automation';
import { FinancesDB } from '../../src/db/db';
import * as repo from '../../src/db/repo';
import { CATEGORY_IDS } from '../../src/db/seed';
import { monthlyInterest, pendingInterestMonths, tinFromTae } from '../../src/lib/finance/interest';
import { account, tx } from './helpers';

const TIN_25 = 12 * (1.025 ** (1 / 12) - 1);

describe('interest maths', () => {
  it('TIN = 12 × ((1 + TAE/100)^(1/12) − 1)', () => {
    expect(tinFromTae(2.5)).toBeCloseTo(0.024718, 6);
    expect(tinFromTae(0)).toBe(0);
  });

  it('constant balance: balance × TIN / 365 × days, minus withholding', () => {
    const acc = account({ id: 's', type: 'remunerat', initialBalanceCents: 1000000, initialBalanceDate: '2026-01-01', tae: 2.5, withholdingPct: 19 });
    const { grossCents, netCents } = monthlyInterest(acc, [], '2026-03');
    expect(grossCents).toBeCloseTo((1000000 * TIN_25 * 31) / 365, 6);
    expect(netCents).toBe(Math.round(((1000000 * TIN_25 * 31) / 365) * 0.81));
    // 10.000 € during March at TAE 2,5 %: 20,99 € gross, 17,00 € net.
    expect(netCents).toBe(1700);
  });

  it('uses the end-of-day balance of every day when it changes during the month', () => {
    const acc = account({ id: 's', type: 'remunerat', initialBalanceCents: 1000000, initialBalanceDate: '2026-01-01', tae: 2.5, withholdingPct: 19 });
    const txs = [
      tx({ type: 'transfer', amountCents: 500000, date: '2026-04-11', accountId: 'a', toAccountId: 's' }),
      tx({ type: 'expense', amountCents: 200000, date: '2026-04-21', accountId: 's' }),
    ];
    // April: 10 days at 10.000 €, 10 days at 15.000 €, 10 days at 13.000 €.
    const expectedGross = ((1000000 * 10 + 1500000 * 10 + 1300000 * 10) * TIN_25) / 365;
    const { grossCents, netCents } = monthlyInterest(acc, txs, '2026-04');
    expect(grossCents).toBeCloseTo(expectedGross, 6);
    expect(netCents).toBe(Math.round(expectedGross * 0.81));
  });

  it('applies the withholding (default 19 %) and counts only days after the initial balance', () => {
    const acc = account({ id: 's', type: 'remunerat', initialBalanceCents: 1000000, initialBalanceDate: '2026-03-17', tae: 2.5 });
    const gross = (1000000 * TIN_25 * 15) / 365;
    expect(monthlyInterest(acc, [], '2026-03').netCents).toBe(Math.round(gross * 0.81));
    expect(monthlyInterest({ ...acc, withholdingPct: 0 }, [], '2026-03').netCents).toBe(Math.round(gross));
  });

  it('lists the finished months not processed yet', () => {
    const acc = { type: 'remunerat' as const, tae: 2.5, initialBalanceDate: '2026-08-09' };
    expect(pendingInterestMonths(acc, undefined, '2026-10-09')).toEqual(['2026-08', '2026-09']);
    expect(pendingInterestMonths(acc, '2026-08', '2026-10-09')).toEqual(['2026-09']);
    expect(pendingInterestMonths(acc, '2026-09', '2026-10-31')).toEqual([]);
    expect(pendingInterestMonths({ ...acc, type: 'corrent' }, undefined, '2026-10-09')).toEqual([]);
    expect(pendingInterestMonths({ ...acc, tae: 0 }, undefined, '2026-10-09')).toEqual([]);
  });
});

describe('interest generation in the database', () => {
  let db: FinancesDB;

  beforeEach(async () => {
    db = new FinancesDB(`int-${Math.random()}`);
    repo.setDatabase(db);
    await repo.ensureSeed();
  });

  it('creates one income per finished month, on its last day, and never twice', async () => {
    const id = await repo.createAccount({ name: 'Compte remunerat', type: 'remunerat', color: '#000', initialBalanceCents: 1000000, initialBalanceDate: '2026-08-09', tae: 2.5, withholdingPct: 19 });
    const result = await runAutomation('2026-10-09', db);
    expect(result.interestCreated).toBe(2);
    const rows = (await db.transactions.toArray()).sort((a, b) => a.date.localeCompare(b.date));
    expect(rows.map((r) => r.date)).toEqual(['2026-08-31', '2026-09-30']);
    expect(rows[0]).toMatchObject({ type: 'income', source: 'interest', accountId: id, categoryId: CATEGORY_IDS.interest, description: 'Interessos agost 2026' });
    expect(rows[1].description).toBe('Interessos setembre 2026');
    // August: 23 days of 10.000 €.
    expect(rows[0].amountCents).toBe(Math.round(((1000000 * TIN_25 * 23) / 365) * 0.81));
    // September compounds August's interest.
    expect(rows[1].amountCents).toBe(Math.round((((1000000 + rows[0].amountCents) * TIN_25 * 30) / 365) * 0.81));

    await runAutomation('2026-10-09', db);
    await runAutomation('2026-10-31', db);
    expect(await db.transactions.count()).toBe(2);
    expect((await repo.getSettings()).interestProcessed).toEqual({ [id]: '2026-09' });
  });

  it('an edited or deleted interest movement is not regenerated', async () => {
    await repo.createAccount({ name: 'Remunerat', type: 'remunerat', color: '#000', initialBalanceCents: 500000, initialBalanceDate: '2026-08-01', tae: 3 });
    await runAutomation('2026-10-09', db);
    const [aug, sep] = (await db.transactions.toArray()).sort((a, b) => a.date.localeCompare(b.date));
    await repo.deleteMovement(aug.id);
    await repo.saveMovement({ type: 'income', date: sep.date, amountCents: 1234, categoryId: sep.categoryId, accountId: sep.accountId, description: sep.description }, sep.id);
    await runAutomation('2026-10-09', db);
    const rows = await db.transactions.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].amountCents).toBe(1234);
    // The next month is processed normally.
    await runAutomation('2026-11-01', db);
    expect(await db.transactions.count()).toBe(2);
  });

  it('ignores current accounts and savings accounts without TAE', async () => {
    await repo.createAccount({ name: 'Corrent', type: 'corrent', color: '#000', initialBalanceCents: 1000000, initialBalanceDate: '2026-01-01' });
    await repo.createAccount({ name: 'Sense TAE', type: 'remunerat', color: '#000', initialBalanceCents: 1000000, initialBalanceDate: '2026-01-01' });
    await runAutomation('2026-10-09', db);
    expect(await db.transactions.count()).toBe(0);
  });

  it('brings the Interessos category back if it was deleted', async () => {
    await repo.deleteCategory(CATEGORY_IDS.interest, CATEGORY_IDS.otherIncome);
    await repo.createAccount({ name: 'Remunerat', type: 'remunerat', color: '#000', initialBalanceCents: 1000000, initialBalanceDate: '2026-09-01', tae: 2 });
    await runAutomation('2026-10-09', db);
    const [row] = await db.transactions.toArray();
    expect(await db.categories.get(row.categoryId!)).toMatchObject({ name: 'Interessos', kind: 'income' });
  });
});
