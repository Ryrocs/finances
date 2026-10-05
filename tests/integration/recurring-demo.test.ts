import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '@/server/db';
import { accounts, transactions } from '@/server/db/schema';
import { listAccounts } from '@/server/services/accounts';
import { listBudgets, upsertBudget } from '@/server/services/budgets';
import { hasDemoData, loadDemoData, removeDemoData } from '@/server/services/demo';
import { createRecurring, generateDueForAllUsers, generateDueForUser, listRecurring, updateRecurring } from '@/server/services/recurring';
import { monthSummary } from '@/server/services/reports';
import { createTransaction, deleteTransaction, listTransactions } from '@/server/services/transactions';
import { categoryId, makeAccount, makeUser, resetDb } from './helpers';

beforeEach(resetDb);

const rent = (accountId: string, categoryId: string, startDate = '2026-01-31') => ({
  type: 'expense' as const,
  amountCents: 75_000,
  accountId,
  categoryId,
  description: 'Rent',
  notes: null,
  frequency: 'monthly' as const,
  interval: 1,
  startDate,
  endDate: null,
  isActive: true,
});

describe('recurring movements', () => {
  it('generates every due occurrence once, clamping month ends', async () => {
    const user = await makeUser('rec');
    const acc = await makeAccount(user.id, 'Main', 0, { date: '2026-01-01' });
    const housing = await categoryId(user.id, 'housing');
    const rule = await createRecurring(user.id, rent(acc.id, housing), '2026-05-15');
    const dates = (await listTransactions(user.id, {})).items.map((t) => t.date).sort();
    expect(dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    expect(rule.nextDate).toBe('2026-05-31');

    // Running again (or on the same day from cron) creates nothing.
    expect(await generateDueForUser(user.id, '2026-05-15')).toBe(0);
    expect(await generateDueForUser(user.id, '2026-05-31')).toBe(1);
    expect((await listTransactions(user.id, {})).items).toHaveLength(5);
  });

  it('is safe under concurrent runs (no duplicate occurrences)', async () => {
    const user = await makeUser('race');
    const acc = await makeAccount(user.id, 'Main', 0, { date: '2026-01-01' });
    const housing = await categoryId(user.id, 'housing');
    await createRecurring(user.id, { ...rent(acc.id, housing), isActive: false }, '2026-01-01');
    const [rule] = await listRecurring(user.id);
    await updateRecurring(user.id, rule.id, rent(acc.id, housing, '2026-01-31'), '2025-12-31'); // activate without generating yet
    await Promise.all(Array.from({ length: 6 }, () => generateDueForUser(user.id, '2026-10-05')));
    const items = (await listTransactions(user.id, {})).items;
    expect(items).toHaveLength(9);
    expect(new Set(items.map((t) => t.date)).size).toBe(9);
  });

  it('does not recreate an occurrence the user deleted, and edits do not regenerate history', async () => {
    const user = await makeUser('del');
    const acc = await makeAccount(user.id, 'Main', 0);
    const housing = await categoryId(user.id, 'housing');
    const rule = await createRecurring(user.id, rent(acc.id, housing, '2026-10-01'), '2026-10-05');
    const [tx] = (await listTransactions(user.id, {})).items;
    await deleteTransaction(user.id, tx.id);
    expect(await generateDueForUser(user.id, '2026-10-20')).toBe(0);
    await updateRecurring(user.id, rule.id, { ...rent(acc.id, housing, '2026-10-01'), amountCents: 80_000 }, '2026-10-20');
    expect((await listTransactions(user.id, {})).items).toHaveLength(0);
    expect(await generateDueForUser(user.id, '2026-11-01')).toBe(1);
    expect((await listTransactions(user.id, {})).items[0]).toMatchObject({ amountCents: 80_000, date: '2026-11-01' });
  });

  it('supports recurring income and transfers; cron covers all users', async () => {
    const user = await makeUser('cron');
    const a = await makeAccount(user.id, 'A', 0, { date: '2026-09-01' });
    const b = await makeAccount(user.id, 'B', 0, { date: '2026-09-01' });
    const salary = await categoryId(user.id, 'salary');
    await createRecurring(user.id, { ...rent(a.id, salary, '2026-09-01'), type: 'income' }, '2026-08-31');
    await createRecurring(
      user.id,
      { type: 'transfer', amountCents: 10_000, accountId: a.id, toAccountId: b.id, description: '', notes: null, frequency: 'weekly', interval: 2, startDate: '2026-09-01', endDate: null, isActive: true },
      '2026-08-31',
    );
    const result = await generateDueForAllUsers(new Date('2026-10-05T10:00:00Z'));
    expect(result.created).toBe(2 + 3);
    const balances = await listAccounts(user.id, '2026-10-05');
    expect(balances.find((x) => x.id === a.id)?.balanceCents).toBe(150_000 - 30_000);
    expect(balances.find((x) => x.id === b.id)?.balanceCents).toBe(30_000);
    expect((await generateDueForAllUsers(new Date('2026-10-05T12:00:00Z'))).created).toBe(0);
  });

  it('feeds fixed costs into the projection instead of extrapolating them', async () => {
    const user = await makeUser('proj');
    const acc = await makeAccount(user.id, 'Main', 0);
    const housing = await categoryId(user.id, 'housing');
    const food = await categoryId(user.id, 'food');
    await createRecurring(user.id, rent(acc.id, housing, '2026-10-01'), '2026-10-10');
    await createTransaction(user.id, { type: 'expense', amountCents: 10_000, date: '2026-10-05', accountId: acc.id, categoryId: food, description: '', notes: null });
    const s = await monthSummary(user.id, '2026-10', '2026-10-10');
    expect(s.projection.fixedCents).toBe(75_000);
    expect(s.projection.projectedCents).toBe(75_000 + 31_000);
  });
});

describe('demo data', () => {
  it('loads flagged data, never twice, and removal keeps real data', async () => {
    const user = await makeUser('demo');
    const real = await makeAccount(user.id, 'My real account', 12_345);
    const food = await categoryId(user.id, 'food');
    await upsertBudget(user.id, { categoryId: food, amountCents: 20_000 });

    const { created } = await loadDemoData(user.id, 'ca', 'EUR', '2026-10-05');
    expect(created).toBeGreaterThan(50);
    expect(await hasDemoData(user.id)).toBe(true);
    expect((await loadDemoData(user.id, 'ca', 'EUR', '2026-10-05')).created).toBe(0);
    // The user's own budget isn't overwritten by demo budgets.
    expect((await listBudgets(user.id)).find((b) => b.categoryId === food)).toMatchObject({ amountCents: 20_000, isDemo: false });
    // Demo transactions never appear after "today".
    const all = (await listTransactions(user.id, { limit: 200 })).items;
    expect(all.every((t) => t.date <= '2026-10-05')).toBe(true);

    // A real movement in a demo account and a real one in the real account.
    const demoChecking = (await listAccounts(user.id, '2026-10-05')).find((a) => a.isDemo)!;
    await createTransaction(user.id, { type: 'expense', amountCents: 999, date: '2026-10-05', accountId: demoChecking.id, categoryId: food, description: 'mine', notes: null });
    await createTransaction(user.id, { type: 'expense', amountCents: 2_000, date: '2026-10-05', accountId: real.id, categoryId: food, description: 'mine too', notes: null });

    const result = await removeDemoData(user.id);
    expect(result).toEqual({ removedAccounts: 2, keptAccounts: 1 });
    expect(await hasDemoData(user.id)).toBe(false);

    const left = (await listTransactions(user.id, {})).items;
    expect(left.map((t) => t.description).sort()).toEqual(['mine', 'mine too']);
    const accs = await listAccounts(user.id, '2026-10-05');
    expect(accs.find((a) => a.id === real.id)?.balanceCents).toBe(12_345 - 2_000);
    expect(accs.find((a) => a.id === demoChecking.id)).toMatchObject({ isDemo: false, balanceCents: -999 });
    expect(await listBudgets(user.id)).toEqual([expect.objectContaining({ categoryId: food, isDemo: false })]);
    expect(await listRecurring(user.id)).toEqual([]);
    const orphan = await getDb().select().from(transactions).where(and(eq(transactions.userId, user.id), eq(transactions.isDemo, true)));
    expect(orphan).toHaveLength(0);
    expect((await getDb().select().from(accounts).where(eq(accounts.userId, user.id))).length).toBe(2);
  });
});
