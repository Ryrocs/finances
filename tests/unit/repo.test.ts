import { beforeEach, describe, expect, it } from 'vitest';
import { FinancesDB } from '../../src/db/db';
import * as repo from '../../src/db/repo';
import { CATEGORY_IDS } from '../../src/db/seed';

let db: FinancesDB;

beforeEach(async () => {
  db = new FinancesDB(`test-${Math.random()}`);
  repo.setDatabase(db);
  await repo.ensureSeed();
});

const checking = { name: 'Compte corrent', type: 'corrent' as const, color: '#000', initialBalanceCents: 100000, initialBalanceDate: '2026-08-01' };
const cash = { name: 'Efectiu', type: 'efectiu' as const, color: '#111', initialBalanceCents: 5000, initialBalanceDate: '2026-08-01' };

describe('repository', () => {
  it('seeds the initial categories once', async () => {
    await repo.ensureSeed();
    const categories = await db.categories.toArray();
    expect(categories.filter((c) => c.kind === 'expense')).toHaveLength(12);
    expect(categories.filter((c) => c.kind === 'income')).toHaveLength(5);
    expect(categories.find((c) => c.name === 'Restauració')?.emoji).toBe('🍔');
  });

  it('saves, edits and deletes movements and remembers the last account', async () => {
    const a = await repo.createAccount(checking);
    const id = await repo.saveMovement({ type: 'expense', date: '2026-10-05', amountCents: 2450, categoryId: 'cat_restauracio', accountId: a, description: '  Sopar ' });
    expect(await db.transactions.get(id)).toMatchObject({ amountCents: 2450, description: 'Sopar', source: 'manual' });
    expect((await repo.getSettings()).lastAccountId).toBe(a);
    await repo.saveMovement({ type: 'expense', date: '2026-10-05', amountCents: 3000, categoryId: 'cat_restauracio', accountId: a }, id);
    const edited = await db.transactions.get(id);
    expect(edited?.amountCents).toBe(3000);
    expect(edited?.description).toBeUndefined();
    await repo.deleteMovement(id);
    expect(await db.transactions.count()).toBe(0);
  });

  it('refuses invalid movements even if the form is bypassed', async () => {
    const a = await repo.createAccount(checking);
    await expect(repo.saveMovement({ type: 'expense', date: '2026-07-01', amountCents: 100, categoryId: 'cat_oci', accountId: a })).rejects.toThrow();
    await expect(repo.saveMovement({ type: 'transfer', date: '2026-10-01', amountCents: 100, accountId: a, toAccountId: a })).rejects.toThrow();
    await expect(repo.saveMovement({ type: 'expense', date: '2026-10-01', amountCents: 0, categoryId: 'cat_oci', accountId: a })).rejects.toThrow();
    expect(await db.transactions.count()).toBe(0);
  });

  it('deleting an account deletes its movements, transfers included', async () => {
    const a = await repo.createAccount(checking);
    const b = await repo.createAccount(cash);
    await repo.saveMovement({ type: 'expense', date: '2026-10-05', amountCents: 100, categoryId: 'cat_oci', accountId: a });
    await repo.saveMovement({ type: 'transfer', date: '2026-10-05', amountCents: 100, accountId: b, toAccountId: a });
    const kept = await repo.saveMovement({ type: 'expense', date: '2026-10-05', amountCents: 100, categoryId: 'cat_oci', accountId: b });
    await repo.deleteAccount(a);
    expect((await db.transactions.toArray()).map((t) => t.id)).toEqual([kept]);
  });

  it('deleting a category reassigns its movements, rules and budgets: no orphans', async () => {
    const a = await repo.createAccount(checking);
    const id = await repo.saveMovement({ type: 'expense', date: '2026-10-05', amountCents: 100, categoryId: 'cat_oci', accountId: a });
    await repo.createRule({ type: 'expense', date: '2026-10-01', startDate: '2026-10-01', amountCents: 500, categoryId: 'cat_oci', accountId: a, frequency: 'monthly', dayOfMonth: 1 }, '2026-10-09');
    await repo.saveBudget('default', 10000, { cat_oci: 2000 });
    const categories = await db.categories.toArray();
    const target = repo.defaultReassignTarget(categories, categories.find((c) => c.id === 'cat_oci')!);
    expect(target?.id).toBe(CATEGORY_IDS.otherExpense);
    await repo.deleteCategory('cat_oci', target!.id);
    expect((await db.transactions.get(id))?.categoryId).toBe(CATEGORY_IDS.otherExpense);
    expect((await db.recurringRules.toArray())[0].categoryId).toBe(CATEGORY_IDS.otherExpense);
    expect((await db.transactions.toArray()).every((t) => t.categoryId !== 'cat_oci')).toBe(true);
    expect((await db.budgets.toArray())[0].perCategory).toEqual({});
  });

  it('wipes everything and seeds again', async () => {
    await repo.createAccount(checking);
    await repo.setSetting('onboardingDone', true);
    await repo.wipeAll();
    expect(await db.accounts.count()).toBe(0);
    expect((await repo.getSettings()).onboardingDone).toBeUndefined();
    expect(await db.categories.count()).toBe(17);
  });
});

describe('budgets in the database', () => {
  it('customising a month copies the default; resetting goes back to it', async () => {
    await repo.saveBudget('default', 100000, { cat_oci: 5000, cat_compres: 0 });
    expect((await db.budgets.where('month').equals('default').first())?.perCategory).toEqual({ cat_oci: 5000 });
    await repo.customizeMonth('2026-10');
    await repo.saveBudget('2026-10', 120000, { cat_oci: 9000 });
    expect(await db.budgets.count()).toBe(2);
    expect((await db.budgets.where('month').equals('default').first())?.totalCents).toBe(100000);
    await repo.resetMonthToDefault('2026-10');
    expect((await db.budgets.toArray()).map((x) => x.month)).toEqual(['default']);
  });
});
