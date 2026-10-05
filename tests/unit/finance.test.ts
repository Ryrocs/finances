import { describe, expect, it } from 'vitest';
import { accountBalance, balanceAsOf, flowsForAccount, liquidWealth, movementEffect, type MovementLike } from '@/lib/finance/balances';
import { budgetLevel, budgetStatus, dailyAllowance } from '@/lib/finance/budget';
import { compareAmounts, compareCategories, groupTotals, summarizeCashFlow, totalsByCategory } from '@/lib/finance/cashflow';
import { buildNetWorthSeries, periodStart, valueAt } from '@/lib/finance/networth';
import { projectSpending } from '@/lib/finance/projection';
import { nextOccurrence, occurrencesBetween } from '@/lib/finance/recurring';
import { niceTicks } from '@/lib/chart-scale';

const checking = { id: 'chk', initialBalanceCents: 0, initialBalanceDate: '2026-10-01', isLiquid: true };
const savings = { id: 'sav', initialBalanceCents: 0, initialBalanceDate: '2026-10-01', isLiquid: true };

const movements: MovementLike[] = [
  { type: 'income', amountCents: 500_000, accountId: 'chk', toAccountId: null, date: '2026-10-01' },
  { type: 'expense', amountCents: 2_000, accountId: 'chk', toAccountId: null, date: '2026-10-02' },
  { type: 'transfer', amountCents: 100_000, accountId: 'chk', toAccountId: 'sav', date: '2026-10-03' },
];

describe('account balances', () => {
  it('applies initial + income − expenses − transfers out + transfers in', () => {
    expect(accountBalance(10_000, { incomeCents: 5_000, expenseCents: 2_500, transferOutCents: 1_000, transferInCents: 300 })).toBe(11_800);
  });

  it('handles the €5,000 / €20 / transfer scenario', () => {
    expect(balanceAsOf(checking, movements, '2026-10-31')).toBe(398_000);
    expect(balanceAsOf(savings, movements, '2026-10-31')).toBe(100_000);
  });

  it('a transfer moves money but leaves liquid wealth unchanged', () => {
    const before = liquidWealth([
      { isLiquid: true, balanceCents: balanceAsOf(checking, movements, '2026-10-02') },
      { isLiquid: true, balanceCents: balanceAsOf(savings, movements, '2026-10-02') },
    ]);
    const after = liquidWealth([
      { isLiquid: true, balanceCents: balanceAsOf(checking, movements, '2026-10-03') },
      { isLiquid: true, balanceCents: balanceAsOf(savings, movements, '2026-10-03') },
    ]);
    expect(before).toBe(498_000);
    expect(after).toBe(498_000);
  });

  it('a transfer to a non-liquid account reduces liquid wealth', () => {
    expect(liquidWealth([{ isLiquid: true, balanceCents: 1_000 }, { isLiquid: false, balanceCents: 9_000 }])).toBe(1_000);
  });

  it('computes per-movement effects and respects the as-of date', () => {
    expect(movementEffect(movements[2], 'chk')).toBe(-100_000);
    expect(movementEffect(movements[2], 'sav')).toBe(100_000);
    expect(flowsForAccount(movements, 'chk', '2026-10-01')).toEqual({ incomeCents: 500_000, expenseCents: 0, transferOutCents: 0, transferInCents: 0 });
    expect(balanceAsOf({ ...checking, initialBalanceCents: 1_000 }, [], '2026-09-30')).toBe(0); // before its start date
  });

  it('supports negative balances', () => {
    expect(balanceAsOf({ ...checking, initialBalanceCents: -5_000 }, [], '2026-10-05')).toBe(-5_000);
  });
});

describe('cash flow', () => {
  const rows = [
    { type: 'income' as const, amountCents: 200_000, categoryId: 'salary' },
    { type: 'expense' as const, amountCents: 80_000, categoryId: 'housing' },
    { type: 'expense' as const, amountCents: 1_250, categoryId: 'food' },
    { type: 'expense' as const, amountCents: 750, categoryId: 'food' },
    { type: 'transfer' as const, amountCents: 30_000, categoryId: null },
  ];

  it('excludes transfers from income and expenses', () => {
    expect(summarizeCashFlow(rows)).toEqual({ incomeCents: 200_000, expenseCents: 82_000, balanceCents: 118_000, count: 4 });
  });

  it('reports a negative balance when spending exceeds income', () => {
    expect(summarizeCashFlow([{ type: 'expense', amountCents: 5_000, categoryId: 'x' }]).balanceCents).toBe(-5_000);
  });

  it('groups expenses by category, largest first', () => {
    expect(totalsByCategory(rows, 'expense')).toEqual([
      { categoryId: 'housing', amountCents: 80_000, count: 1 },
      { categoryId: 'food', amountCents: 2_000, count: 2 },
    ]);
    const groups = groupTotals(totalsByCategory(rows, 'expense'), (id) => (id === 'housing' ? 'needs' : 'lifestyle'));
    expect(groups).toEqual({ needs: 80_000, lifestyle: 2_000, other: 0 });
  });

  it('compares months (September €421 → October €476 = +€55, +13.1 %)', () => {
    expect(compareAmounts(42_100, 47_600)).toEqual({ fromCents: 42_100, toCents: 47_600, diffCents: 5_500, percent: 13.1 });
    expect(compareAmounts(0, 100).percent).toBeNull();
    const cats = compareCategories({ food: 10_000, travel: 5_000 }, { food: 12_000, shopping: 3_000 });
    expect(cats.map((c) => c.categoryId)).toEqual(['travel', 'shopping', 'food']);
    expect(cats.find((c) => c.categoryId === 'food')?.percent).toBe(20);
  });
});

describe('budgets', () => {
  it('warns from 80 % and flags exceeded above 100 %', () => {
    expect(budgetLevel(7_900, 10_000)).toBe('ok');
    expect(budgetLevel(8_000, 10_000)).toBe('warning');
    expect(budgetLevel(10_000, 10_000)).toBe('warning');
    expect(budgetLevel(10_001, 10_000)).toBe('exceeded');
  });

  it('reports spent, remaining and percentage', () => {
    expect(budgetStatus(9_500, 8_000)).toEqual({ budgetCents: 8_000, spentCents: 9_500, remainingCents: -1_500, percent: 119, level: 'exceeded' });
    expect(dailyAllowance(10_000, 3)).toBe(3_333);
    expect(dailyAllowance(-1, 3)).toBe(0);
  });
});

describe('spending projection', () => {
  const base = { month: '2026-10', variableCents: 0, fixedCents: 0 };

  it('is hidden during the first days of the month', () => {
    expect(projectSpending({ ...base, today: '2026-10-04', variableCents: 10_000 }).status).toBe('too_early');
  });

  it('extrapolates spent / days elapsed × days in month', () => {
    // €260 after 10 days of a 30-day month → €780.
    const p = projectSpending({ month: '2026-11', today: '2026-11-10', variableCents: 26_000, fixedCents: 0 });
    expect(p.status).toBe('available');
    expect(p.projectedCents).toBe(78_000);
    expect(p.dailyRateCents).toBe(2_600);
  });

  it('does not extrapolate fixed recurring costs', () => {
    const p = projectSpending({ ...base, today: '2026-10-10', variableCents: 10_000, fixedCents: 80_000, pendingFixedCents: 1_299 });
    expect(p.projectedCents).toBe(80_000 + 1_299 + 31_000);
  });

  it('flags a high rate against the budget, the usual average or income', () => {
    expect(projectSpending({ ...base, today: '2026-10-10', variableCents: 50_000, budgetCents: 100_000 })).toMatchObject({ reference: 'budget', high: true });
    expect(projectSpending({ ...base, today: '2026-10-10', variableCents: 20_000, averageCents: 40_000 })).toMatchObject({ reference: 'average', high: true });
    expect(projectSpending({ ...base, today: '2026-10-10', variableCents: 10_000, averageCents: 40_000 })).toMatchObject({ reference: 'average', high: false });
    expect(projectSpending({ ...base, today: '2026-10-10', variableCents: 10_000, incomeCents: 20_000 })).toMatchObject({ reference: 'income', high: true });
  });

  it('reports actual spending for past months and nothing for future ones', () => {
    expect(projectSpending({ ...base, month: '2026-09', today: '2026-10-05', variableCents: 30_000 })).toMatchObject({ status: 'past', projectedCents: 30_000, dailyRateCents: 1_000 });
    expect(projectSpending({ ...base, month: '2026-11', today: '2026-10-05' }).status).toBe('future');
  });

  it('handles February in leap years', () => {
    const p = projectSpending({ month: '2028-02', today: '2028-02-10', variableCents: 10_000, fixedCents: 0 });
    expect(p.daysInMonth).toBe(29);
    expect(p.projectedCents).toBe(29_000);
  });
});

describe('recurring schedule', () => {
  it('clamps monthly rules on the 31st without drifting', () => {
    const rule = { frequency: 'monthly' as const, interval: 1, startDate: '2026-01-31', endDate: null };
    expect(occurrencesBetween(rule, null, '2026-05-31')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
  });

  it('handles Feb 29 yearly rules', () => {
    const rule = { frequency: 'yearly' as const, interval: 1, startDate: '2028-02-29', endDate: null };
    expect(occurrencesBetween(rule, null, '2032-12-31')).toEqual(['2028-02-29', '2029-02-28', '2030-02-28', '2031-02-28', '2032-02-29']);
  });

  it('respects interval, end date and the last generated date', () => {
    const rule = { frequency: 'weekly' as const, interval: 2, startDate: '2026-10-01', endDate: '2026-11-15' };
    expect(occurrencesBetween(rule, null, '2026-12-31')).toEqual(['2026-10-01', '2026-10-15', '2026-10-29', '2026-11-12']);
    expect(occurrencesBetween(rule, '2026-10-15', '2026-12-31')).toEqual(['2026-10-29', '2026-11-12']);
    expect(nextOccurrence(rule, '2026-11-12')).toBeNull();
    expect(nextOccurrence({ ...rule, endDate: null }, '2026-10-02')).toBe('2026-10-15');
  });

  it('never generates before the start date', () => {
    expect(occurrencesBetween({ frequency: 'monthly', interval: 1, startDate: '2026-12-01', endDate: null }, null, '2026-10-05')).toEqual([]);
  });
});

describe('net worth history', () => {
  const initials = [{ date: '2026-10-01', cents: 500_000 }];
  const deltas = [
    { date: '2026-10-03', cents: -2_000 },
    { date: '2026-10-10', cents: 150_000 },
  ];

  it('reconstructs real historical values (not today’s balance repeated)', () => {
    const series = buildNetWorthSeries(initials, deltas, '2026-09-30', '2026-10-12');
    expect(series[0]).toEqual({ date: '2026-09-30', cents: 0 });
    expect(series.find((p) => p.date === '2026-10-02')?.cents).toBe(500_000);
    expect(series.find((p) => p.date === '2026-10-05')?.cents).toBe(498_000);
    expect(series.at(-1)).toEqual({ date: '2026-10-12', cents: 648_000 });
    expect(valueAt('2026-10-05', initials, deltas)).toBe(498_000);
  });

  it('includes data before the range in the starting value', () => {
    expect(buildNetWorthSeries(initials, deltas, '2026-10-05', '2026-10-06')).toEqual([
      { date: '2026-10-05', cents: 498_000 },
      { date: '2026-10-06', cents: 498_000 },
    ]);
  });

  it('downsamples long ranges but keeps exact first and last points', () => {
    const series = buildNetWorthSeries(initials, deltas, '2025-10-12', '2026-10-12');
    expect(series.length).toBeLessThanOrEqual(130);
    expect(series[0].date).toBe('2025-10-12');
    expect(series.at(-1)).toEqual({ date: '2026-10-12', cents: 648_000 });
  });

  it('computes period starts', () => {
    expect(periodStart('30d', '2026-10-05', null)).toBe('2026-09-06');
    expect(periodStart('3m', '2026-10-05', null)).toBe('2026-07-05');
    expect(periodStart('12m', '2026-10-05', null)).toBe('2025-10-05');
    expect(periodStart('all', '2026-10-05', '2024-01-01')).toBe('2024-01-01');
  });
});

describe('chart ticks', () => {
  it('produces round ticks including zero', () => {
    expect(niceTicks(0, 47_600, 4)).toEqual([0, 20_000, 40_000, 60_000]);
    expect(niceTicks(-12_000, 30_000, 4)).toEqual([-20_000, 0, 20_000, 40_000]);
    expect(niceTicks(-5_000, 0, 4)).toEqual([-6_000, -4_000, -2_000, 0]);
  });
});
