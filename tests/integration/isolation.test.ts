import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '@/server/db';
import { budgets, transactions } from '@/server/db/schema';
import { deleteAccount, getAccount, listAccounts, updateAccount } from '@/server/services/accounts';
import { deleteBudget, listBudgets, upsertBudget } from '@/server/services/budgets';
import { deleteCategory, listCategories, updateCategory } from '@/server/services/categories';
import { createRecurring, deleteRecurring, listRecurring } from '@/server/services/recurring';
import { monthSummary, netWorth } from '@/server/services/reports';
import { createTransaction, deleteTransaction, getTransaction, listTransactions, updateTransaction } from '@/server/services/transactions';
import { categoryId, makeAccount, makeUser, resetDb } from './helpers';

beforeEach(resetDb);

/** Every read or write by user B on user A's data must fail as "not found" or "invalid". */
describe('user data isolation', () => {
  it('B can neither see nor modify A’s data', async () => {
    const a = await makeUser('alice');
    const b = await makeUser('bob');
    const accA = await makeAccount(a.id, 'Alice checking', 100_000);
    const accB = await makeAccount(b.id, 'Bob checking', 0);
    const foodA = await categoryId(a.id, 'food');
    const foodB = await categoryId(b.id, 'food');
    const { transaction: txA } = await createTransaction(a.id, { type: 'expense', amountCents: 2_000, date: '2026-10-02', accountId: accA.id, categoryId: foodA, description: 'secret', notes: null });
    const budgetA = await upsertBudget(a.id, { categoryId: foodA, amountCents: 5_000 });
    const ruleA = await createRecurring(
      a.id,
      { type: 'expense', amountCents: 100, accountId: accA.id, categoryId: foodA, description: '', notes: null, frequency: 'monthly', interval: 1, startDate: '2026-10-01', endDate: null, isActive: true },
      '2026-10-05',
    );

    // Reads
    expect(await listAccounts(b.id, '2026-10-05')).toEqual([expect.objectContaining({ id: accB.id })]);
    expect((await listTransactions(b.id, {})).items).toEqual([]);
    expect((await listTransactions(b.id, { q: 'secret' })).items).toEqual([]);
    expect(await listBudgets(b.id)).toEqual([]);
    expect(await listRecurring(b.id)).toEqual([]);
    expect((await listCategories(b.id)).some((c) => c.id === foodA)).toBe(false);
    expect((await monthSummary(b.id, '2026-10', '2026-10-05')).expenseCents).toBe(0);
    expect((await netWorth(b.id, 'all', '2026-10-05')).liquidCents).toBe(0);
    await expect(getAccount(b.id, accA.id)).rejects.toMatchObject({ code: 'not_found' });
    await expect(getTransaction(b.id, txA.id)).rejects.toMatchObject({ code: 'not_found' });

    // Writes on A's rows
    await expect(updateAccount(b.id, accA.id, { name: 'hacked' })).rejects.toMatchObject({ code: 'not_found' });
    await expect(deleteAccount(b.id, accA.id)).rejects.toMatchObject({ code: 'not_found' });
    await expect(
      updateTransaction(b.id, txA.id, { type: 'expense', amountCents: 1, date: '2026-10-02', accountId: accB.id, categoryId: foodB, description: '', notes: null }),
    ).rejects.toMatchObject({ code: 'not_found' });
    await expect(deleteTransaction(b.id, txA.id)).rejects.toMatchObject({ code: 'not_found' });
    await expect(deleteBudget(b.id, budgetA.id)).rejects.toMatchObject({ code: 'not_found' });
    await expect(deleteRecurring(b.id, ruleA.id)).rejects.toMatchObject({ code: 'not_found' });
    await expect(updateCategory(b.id, foodA, { name: 'x' })).rejects.toMatchObject({ code: 'not_found' });
    await expect(deleteCategory(b.id, foodA)).rejects.toMatchObject({ code: 'not_found' });

    // Referencing A's account/category from B's own movement
    await expect(
      createTransaction(b.id, { type: 'expense', amountCents: 1, date: '2026-10-02', accountId: accA.id, categoryId: foodB, description: '', notes: null }),
    ).rejects.toMatchObject({ code: 'validation', fields: { accountId: 'invalid' } });
    await expect(
      createTransaction(b.id, { type: 'expense', amountCents: 1, date: '2026-10-02', accountId: accB.id, categoryId: foodA, description: '', notes: null }),
    ).rejects.toMatchObject({ code: 'validation', fields: { categoryId: 'invalid' } });
    await expect(
      createTransaction(b.id, { type: 'transfer', amountCents: 1, date: '2026-10-02', accountId: accB.id, toAccountId: accA.id, description: '', notes: null }),
    ).rejects.toMatchObject({ code: 'validation', fields: { toAccountId: 'invalid' } });
    await expect(upsertBudget(b.id, { categoryId: foodA, amountCents: 1 })).rejects.toMatchObject({ code: 'validation' });

    // A's data is untouched.
    expect((await getAccount(a.id, accA.id)).name).toBe('Alice checking');
    expect((await getTransaction(a.id, txA.id)).amountCents).toBe(2_000);
  });

  it('the database itself refuses cross-user references (composite foreign keys)', async () => {
    const a = await makeUser('alice');
    const b = await makeUser('bob');
    const accA = await makeAccount(a.id, 'A', 0);
    const foodA = await categoryId(a.id, 'food');
    const foodB = await categoryId(b.id, 'food');
    await expect(
      getDb().insert(transactions).values({ userId: b.id, type: 'expense', amountCents: 1, date: '2026-10-01', accountId: accA.id, categoryId: foodB }),
    ).rejects.toThrow();
    await expect(getDb().insert(budgets).values({ userId: b.id, categoryId: foodA, amountCents: 1 })).rejects.toThrow();
  });
});
