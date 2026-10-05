import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '@/server/db';
import { transactions } from '@/server/db/schema';
import { deleteAccount, getAccount, listAccounts, updateAccount } from '@/server/services/accounts';
import { budgetOverview, upsertBudget, listBudgets } from '@/server/services/budgets';
import { deleteCategory, listCategories } from '@/server/services/categories';
import { analytics, monthSummary, netWorth } from '@/server/services/reports';
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  updateTransaction,
} from '@/server/services/transactions';
import { categoryId, makeAccount, makeUser, resetDb } from './helpers';

beforeEach(resetDb);

async function scenario() {
  const user = await makeUser('fin');
  const checking = await makeAccount(user.id, 'Checking', 500_000);
  const savings = await makeAccount(user.id, 'Savings', 0);
  const food = await categoryId(user.id, 'food');
  const salary = await categoryId(user.id, 'salary');
  return { user, checking, savings, food, salary };
}

describe('movements, balances and net worth', () => {
  it('€5,000 + €20 expense + €1,000 transfer → correct balances, unchanged wealth', async () => {
    const { user, checking, savings, food } = await scenario();
    await createTransaction(user.id, { type: 'expense', amountCents: 2_000, date: '2026-10-02', accountId: checking.id, categoryId: food, description: 'Super', notes: null });
    await createTransaction(user.id, { type: 'transfer', amountCents: 100_000, date: '2026-10-03', accountId: checking.id, toAccountId: savings.id, description: '', notes: null });

    const accounts = await listAccounts(user.id, '2026-10-05');
    expect(accounts.find((a) => a.id === checking.id)?.balanceCents).toBe(398_000);
    expect(accounts.find((a) => a.id === savings.id)?.balanceCents).toBe(100_000);

    const summary = await monthSummary(user.id, '2026-10', '2026-10-05');
    expect(summary).toMatchObject({ incomeCents: 0, expenseCents: 2_000, balanceCents: -2_000 });
    expect(summary.netWorth.liquidCents).toBe(498_000);

    const nw = await netWorth(user.id, '30d', '2026-10-05');
    expect(nw.liquidCents).toBe(498_000);
    // History is reconstructed: the transfer day doesn't change the total, the expense day does.
    const at = (d: string) => nw.series.find((p) => p.date === d)?.cents;
    expect(at('2026-10-01')).toBe(500_000);
    expect(at('2026-10-02')).toBe(498_000);
    expect(at('2026-10-03')).toBe(498_000);
  });

  it('non-liquid accounts are excluded from liquid wealth', async () => {
    const { user, checking } = await scenario();
    const locked = await makeAccount(user.id, 'Locked deposit', 0, { isLiquid: false });
    await createTransaction(user.id, { type: 'transfer', amountCents: 50_000, date: '2026-10-02', accountId: checking.id, toAccountId: locked.id, description: '', notes: null });
    const nw = await netWorth(user.id, '30d', '2026-10-05');
    expect(nw.liquidCents).toBe(450_000);
    expect(nw.nonLiquidCents).toBe(50_000);
  });

  it('future-dated movements do not affect today’s balance', async () => {
    const { user, checking, food } = await scenario();
    await createTransaction(user.id, { type: 'expense', amountCents: 9_999, date: '2026-12-01', accountId: checking.id, categoryId: food, description: '', notes: null });
    const [acc] = await listAccounts(user.id, '2026-10-05');
    expect(acc.balanceCents).toBe(500_000);
    expect(acc.transactionCount).toBe(1);
  });

  it('edits and deletes movements', async () => {
    const { user, checking, food, salary } = await scenario();
    const { transaction } = await createTransaction(user.id, { type: 'expense', amountCents: 1_000, date: '2026-10-02', accountId: checking.id, categoryId: food, description: 'a', notes: null });
    await updateTransaction(user.id, transaction.id, { type: 'income', amountCents: 1_234, date: '2026-10-04', accountId: checking.id, categoryId: salary, description: 'b', notes: 'n' });
    const row = await getTransaction(user.id, transaction.id);
    expect(row).toMatchObject({ type: 'income', amountCents: 1_234, description: 'b', notes: 'n' });
    await deleteTransaction(user.id, transaction.id);
    await expect(getTransaction(user.id, transaction.id)).rejects.toMatchObject({ code: 'not_found' });
  });

  it('rejects a category of the wrong kind and same-account transfers (also at DB level)', async () => {
    const { user, checking, salary } = await scenario();
    await expect(
      createTransaction(user.id, { type: 'expense', amountCents: 100, date: '2026-10-02', accountId: checking.id, categoryId: salary, description: '', notes: null }),
    ).rejects.toMatchObject({ code: 'validation', fields: { categoryId: 'invalid' } });
    await expect(
      getDb().insert(transactions).values({ userId: user.id, type: 'transfer', amountCents: 100, date: '2026-10-02', accountId: checking.id, toAccountId: checking.id }),
    ).rejects.toThrow();
    await expect(
      getDb().insert(transactions).values({ userId: user.id, type: 'expense', amountCents: 0, date: '2026-10-02', accountId: checking.id }),
    ).rejects.toThrow();
  });

  it('keeps amounts exact through the database', async () => {
    const { user, checking, food } = await scenario();
    for (let i = 0; i < 10; i++) {
      await createTransaction(user.id, { type: 'expense', amountCents: 10, date: '2026-10-02', accountId: checking.id, categoryId: food, description: '', notes: null });
    }
    await createTransaction(user.id, { type: 'expense', amountCents: 1_234, date: '2026-10-02', accountId: checking.id, categoryId: food, description: '', notes: null });
    const summary = await monthSummary(user.id, '2026-10', '2026-10-05');
    expect(summary.expenseCents).toBe(1_334);
  });

  it('handles large balances', async () => {
    const user = await makeUser('rich');
    const acc = await makeAccount(user.id, 'Big', 99_999_999_999_000);
    expect((await getAccount(user.id, acc.id)).initialBalanceCents).toBe(99_999_999_999_000);
  });

  it('lists with search, filters, totals and keyset pagination', async () => {
    const { user, checking, savings, food } = await scenario();
    for (let i = 1; i <= 7; i++) {
      await createTransaction(user.id, { type: 'expense', amountCents: i * 100, date: `2026-10-0${i}`, accountId: checking.id, categoryId: food, description: i % 2 ? 'Mercat' : 'Super', notes: null });
    }
    await createTransaction(user.id, { type: 'transfer', amountCents: 5_000, date: '2026-10-04', accountId: checking.id, toAccountId: savings.id, description: '', notes: null });

    const page1 = await listTransactions(user.id, { month: '2026-10', limit: 3 });
    expect(page1.items.map((t) => t.date)).toEqual(['2026-10-07', '2026-10-06', '2026-10-05']);
    expect(page1.totals).toEqual({ count: 8, incomeCents: 0, expenseCents: 2_800 });
    const page2 = await listTransactions(user.id, { month: '2026-10', limit: 3, cursor: page1.nextCursor! });
    const page3 = await listTransactions(user.id, { month: '2026-10', limit: 3, cursor: page2.nextCursor! });
    const all = [...page1.items, ...page2.items, ...page3.items];
    expect(new Set(all.map((t) => t.id)).size).toBe(8);
    expect(page3.nextCursor).toBeNull();

    expect((await listTransactions(user.id, { q: 'merc' })).items).toHaveLength(4);
    expect((await listTransactions(user.id, { q: '3,00' })).items.map((t) => t.amountCents)).toEqual([300]);
    expect((await listTransactions(user.id, { type: 'transfer' })).items).toHaveLength(1);
    expect((await listTransactions(user.id, { accountId: savings.id })).items).toHaveLength(1);
    expect((await listTransactions(user.id, { q: '100%_' })).items).toHaveLength(0);
  });
});

describe('accounts and categories lifecycle', () => {
  it('archiving keeps history; deleting cascades its movements', async () => {
    const { user, checking, savings, food } = await scenario();
    await createTransaction(user.id, { type: 'transfer', amountCents: 1_000, date: '2026-10-02', accountId: checking.id, toAccountId: savings.id, description: '', notes: null });
    await createTransaction(user.id, { type: 'expense', amountCents: 500, date: '2026-10-02', accountId: savings.id, categoryId: food, description: '', notes: null });
    await updateAccount(user.id, savings.id, { archived: true });
    expect((await listAccounts(user.id, '2026-10-05')).find((a) => a.id === savings.id)).toMatchObject({ archived: true, balanceCents: 500 });

    await deleteAccount(user.id, savings.id);
    expect((await listTransactions(user.id, {})).items).toHaveLength(0);
    expect((await listAccounts(user.id, '2026-10-05'))[0].balanceCents).toBe(500_000);
  });

  it('deleting a used category archives it and keeps the movement label', async () => {
    const { user, checking, food } = await scenario();
    await createTransaction(user.id, { type: 'expense', amountCents: 500, date: '2026-10-02', accountId: checking.id, categoryId: food, description: '', notes: null });
    await upsertBudget(user.id, { categoryId: food, amountCents: 10_000 });
    expect(await deleteCategory(user.id, food)).toEqual({ archived: true });
    expect((await listCategories(user.id)).find((c) => c.id === food)?.archived).toBe(true);
    expect((await listTransactions(user.id, {})).items[0].categoryId).toBe(food);
    expect(await listBudgets(user.id)).toHaveLength(0);

    const travel = await categoryId(user.id, 'travel');
    expect(await deleteCategory(user.id, travel)).toEqual({ archived: false });
    expect((await listCategories(user.id)).some((c) => c.id === travel)).toBe(false);
  });
});

describe('budgets', () => {
  it('upserts one overall budget and per-category budgets, warns and flags exceeded', async () => {
    const { user, checking, food } = await scenario();
    const restaurants = await categoryId(user.id, 'restaurants');
    await upsertBudget(user.id, { categoryId: null, amountCents: 50_000 });
    await upsertBudget(user.id, { categoryId: null, amountCents: 60_000 });
    await upsertBudget(user.id, { categoryId: restaurants, amountCents: 8_000 });
    await upsertBudget(user.id, { categoryId: food, amountCents: 10_000 });
    expect(await listBudgets(user.id)).toHaveLength(3);

    await createTransaction(user.id, { type: 'expense', amountCents: 6_500, date: '2026-10-02', accountId: checking.id, categoryId: restaurants, description: '', notes: null });
    const { budgetAlerts } = await createTransaction(user.id, { type: 'expense', amountCents: 2_000, date: '2026-10-03', accountId: checking.id, categoryId: restaurants, description: '', notes: null });
    // Never blocked — the movement was saved, and the user is told.
    expect(budgetAlerts).toEqual([{ categoryId: restaurants, level: 'exceeded', percent: 106, remainingCents: -500 }]);

    const overview = await budgetOverview(user.id, '2026-10', '2026-10-05');
    expect(overview.overall).toMatchObject({ budgetCents: 60_000, spentCents: 8_500, level: 'ok' });
    expect(overview.categories.find((c) => c.categoryId === restaurants)).toMatchObject({ spentCents: 8_500, level: 'exceeded', remainingCents: -500 });
    expect(overview.categories.find((c) => c.categoryId === food)).toMatchObject({ spentCents: 0, level: 'ok' });
    expect(overview.daysLeft).toBe(27);
  });

  it('rejects budgets for income categories', async () => {
    const { user, salary } = await scenario();
    await expect(upsertBudget(user.id, { categoryId: salary, amountCents: 100 })).rejects.toMatchObject({ code: 'validation' });
  });
});

describe('analytics', () => {
  it('aggregates monthly series and per-category maps', async () => {
    const { user, checking, food, salary } = await scenario();
    await createTransaction(user.id, { type: 'expense', amountCents: 42_100, date: '2026-09-15', accountId: checking.id, categoryId: food, description: '', notes: null });
    await createTransaction(user.id, { type: 'expense', amountCents: 47_600, date: '2026-10-02', accountId: checking.id, categoryId: food, description: '', notes: null });
    await createTransaction(user.id, { type: 'income', amountCents: 200_000, date: '2026-10-01', accountId: checking.id, categoryId: salary, description: '', notes: null });
    const a = await analytics(user.id, '2026-08', '2026-10');
    expect(a.months).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(a.series).toEqual([
      { month: '2026-08', incomeCents: 0, expenseCents: 0, balanceCents: 0 },
      { month: '2026-09', incomeCents: 0, expenseCents: 42_100, balanceCents: -42_100 },
      { month: '2026-10', incomeCents: 200_000, expenseCents: 47_600, balanceCents: 152_400 },
    ]);
    expect(a.expensesByMonth['2026-10'][food]).toBe(47_600);
  });
});

describe('persistence', () => {
  it('data survives a brand-new connection pool (like a new serverless instance)', async () => {
    const { user, checking, food } = await scenario();
    await createTransaction(user.id, { type: 'expense', amountCents: 2_000, date: '2026-10-02', accountId: checking.id, categoryId: food, description: 'persist me', notes: null });
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      const { rows } = await pool.query('select amount_cents, description from transactions where user_id = $1', [user.id]);
      expect(rows).toEqual([{ amount_cents: '2000', description: 'persist me' }]);
    } finally {
      await pool.end();
    }
    const count = await getDb().execute(sql`select count(*)::int as n from transactions where user_id = ${user.id}`);
    expect(count.rows[0]).toEqual({ n: 1 });
  });
});
