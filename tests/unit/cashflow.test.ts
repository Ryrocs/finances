import { describe, expect, it } from 'vitest';
import { compareCategories, delta, expensesByCategory, flowTotals, monthTotals, monthlyFlows, savingsRate } from '../../src/lib/finance/cashflow';
import { spendingPace } from '../../src/lib/finance/pace';
import { tx } from './helpers';

const txs = [
  tx({ type: 'income', amountCents: 200000, date: '2026-10-01', categoryId: 'job' }),
  tx({ type: 'expense', amountCents: 50000, date: '2026-10-02', categoryId: 'home' }),
  tx({ type: 'expense', amountCents: 2450, date: '2026-10-03', categoryId: 'food' }),
  tx({ type: 'expense', amountCents: 7550, date: '2026-10-04', categoryId: 'food' }),
  // A transfer between my own accounts: never income or expense.
  tx({ type: 'transfer', amountCents: 100000, date: '2026-10-05', accountId: 'a', toAccountId: 's' }),
  tx({ type: 'expense', amountCents: 9999, date: '2026-09-30', categoryId: 'food' }),
];

describe('cash flow', () => {
  it('transfers never count as income or expense', () => {
    const totals = monthTotals(txs, '2026-10');
    expect(totals.incomeCents).toBe(200000);
    expect(totals.expenseCents).toBe(60000);
    expect(totals.expenseCount).toBe(3);
    expect(flowTotals([txs[4]])).toMatchObject({ incomeCents: 0, expenseCents: 0, balanceCents: 0 });
    expect(expensesByCategory([txs[4]])).toEqual([]);
  });

  it('balance = income − expenses and savings rate = balance ÷ income', () => {
    const totals = monthTotals(txs, '2026-10');
    expect(totals.balanceCents).toBe(140000);
    expect(savingsRate(totals.incomeCents, totals.balanceCents)).toBe(70);
    expect(savingsRate(100000, -25000)).toBe(-25);
  });

  it('has no savings rate without income', () => {
    expect(savingsRate(0, -5000)).toBeNull();
    expect(monthlyFlows(txs, ['2026-09'])[0]).toMatchObject({ incomeCents: 0, expenseCents: 9999, balanceCents: -9999, savingsRate: null });
  });

  it('groups expenses by category, largest first', () => {
    expect(expensesByCategory(txs.filter((t) => t.date >= '2026-10-01'))).toEqual([
      { categoryId: 'home', cents: 50000 },
      { categoryId: 'food', cents: 10000 },
    ]);
  });

  it('compares months', () => {
    expect(delta(6300, 7000)).toEqual({ diffCents: -700, pct: -10 });
    expect(delta(100, 0).pct).toBeNull();
    const cmp = compareCategories(txs.filter((t) => t.date >= '2026-10-01'), txs.filter((t) => t.date < '2026-10-01'));
    expect(cmp.find((c) => c.categoryId === 'food')).toEqual({ categoryId: 'food', previousCents: 9999, currentCents: 10000, diffCents: 1 });
    expect(cmp.find((c) => c.categoryId === 'home')?.previousCents).toBe(0);
  });
});

describe('spending pace', () => {
  const base = { month: '2026-10', today: '2026-10-10', spentCents: 31000, expenseCount: 5 };

  it('projects spent ÷ days elapsed × days in month', () => {
    const pace = spendingPace(base)!;
    expect(pace.daysElapsed).toBe(10);
    expect(pace.daysInMonth).toBe(31);
    expect(pace.projectedCents).toBe(96100);
    expect(pace.budgetPct).toBeNull();
    expect(pace.warning).toBe(false);
  });

  it('is hidden before day 5, with fewer than 3 expenses, or outside the current month', () => {
    expect(spendingPace({ ...base, today: '2026-10-04' })).toBeNull();
    expect(spendingPace({ ...base, today: '2026-10-05' })).not.toBeNull();
    expect(spendingPace({ ...base, expenseCount: 2 })).toBeNull();
    expect(spendingPace({ ...base, month: '2026-09' })).toBeNull();
  });

  it('warns when the budget used runs more than 10 points ahead of the month', () => {
    // Day 10 of 31 = 32,3 % of the month.
    expect(spendingPace({ ...base, budgetCents: 100000 })!.budgetPct).toBe(31);
    expect(spendingPace({ ...base, budgetCents: 100000 })!.warning).toBe(false);
    expect(spendingPace({ ...base, spentCents: 42000, budgetCents: 100000 })!.warning).toBe(false);
    expect(spendingPace({ ...base, spentCents: 43000, budgetCents: 100000 })!.warning).toBe(true);
  });
});
