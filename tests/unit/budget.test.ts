import { describe, expect, it } from 'vitest';
import { budgetLevel, budgetReport, resolveBudget } from '../../src/lib/finance/budget';
import { expensesByCategory, flowTotals, inMonth } from '../../src/lib/finance/cashflow';
import type { Budget } from '../../src/lib/types';
import { tx } from './helpers';

const budgets: Budget[] = [
  { id: 'd', month: 'default', totalCents: 100000, perCategory: { food: 8000, fun: 5000 } },
  { id: 'c', month: '2026-12', totalCents: 150000, perCategory: { food: 20000 } },
];

describe('budgets', () => {
  it('a month uses its own budget, otherwise the default one', () => {
    expect(resolveBudget(budgets, '2026-10')).toMatchObject({ source: 'default', budget: { id: 'd' } });
    expect(resolveBudget(budgets, '2026-12')).toMatchObject({ source: 'custom', budget: { id: 'c' } });
    expect(resolveBudget([], '2026-10')).toEqual({ source: 'none', budget: null });
  });

  it('levels: < 80 % ok, 80–99 % near the limit, ≥ 100 % exceeded', () => {
    expect(budgetLevel(7999, 10000)).toBe('ok');
    expect(budgetLevel(8000, 10000)).toBe('near');
    expect(budgetLevel(9999, 10000)).toBe('near');
    expect(budgetLevel(10000, 10000)).toBe('over');
    expect(budgetLevel(12000, 10000)).toBe('over');
  });

  it('reports spent / budget per category and for the total, with the right budget', () => {
    const txs = [
      tx({ type: 'expense', amountCents: 7200, date: '2026-10-03', categoryId: 'food' }),
      tx({ type: 'expense', amountCents: 6000, date: '2026-10-04', categoryId: 'fun' }),
      tx({ type: 'expense', amountCents: 7200, date: '2026-12-03', categoryId: 'food' }),
      // Transfers never count towards a budget.
      tx({ type: 'transfer', amountCents: 90000, date: '2026-10-05', accountId: 'a', toAccountId: 'b' }),
    ];
    const october = inMonth(txs, '2026-10');
    const report = budgetReport(resolveBudget(budgets, '2026-10').budget, expensesByCategory(october), flowTotals(october).expenseCents);
    expect(report.total).toMatchObject({ spentCents: 13200, budgetCents: 100000, level: 'ok' });
    const food = report.categories.find((l) => l.categoryId === 'food')!;
    expect(food).toMatchObject({ spentCents: 7200, budgetCents: 8000, pct: 90, level: 'near', remainingCents: 800 });
    const fun = report.categories.find((l) => l.categoryId === 'fun')!;
    expect(fun).toMatchObject({ pct: 120, level: 'over', remainingCents: -1000 });
    // Sorted by % used.
    expect(report.categories[0].categoryId).toBe('fun');

    const december = inMonth(txs, '2026-12');
    const custom = budgetReport(resolveBudget(budgets, '2026-12').budget, expensesByCategory(december), flowTotals(december).expenseCents);
    expect(custom.categories).toHaveLength(1);
    expect(custom.categories[0]).toMatchObject({ budgetCents: 20000, pct: 36, level: 'ok' });
  });

  it('without a budget there is nothing to report', () => {
    expect(budgetReport(null, [], 0)).toEqual({ total: null, categories: [] });
  });
});
