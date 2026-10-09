import { describe, expect, it } from 'vitest';
import { fittedDomain, zeroBasedDomain } from '../../src/lib/chart-scale';
import { wealthAsOf } from '../../src/lib/finance/balances';
import { rangeStart, samplePoints, wealthHistory } from '../../src/lib/finance/wealth';
import { account, tx } from './helpers';

const accounts = [
  account({ id: 'a', initialBalanceCents: 100000, initialBalanceDate: '2026-08-09' }),
  account({ id: 's', initialBalanceCents: 300000, initialBalanceDate: '2026-09-01' }),
];
const txs = [
  tx({ type: 'income', amountCents: 150000, date: '2026-09-01', accountId: 'a' }),
  tx({ type: 'expense', amountCents: 20000, date: '2026-09-15', accountId: 'a' }),
  tx({ type: 'transfer', amountCents: 50000, date: '2026-09-20', accountId: 'a', toAccountId: 's' }),
  tx({ type: 'expense', amountCents: 5000, date: '2026-10-03', accountId: 's' }),
];
const today = '2026-10-09';

describe('wealth history', () => {
  it('starts at the earliest initial balance, never with 0 € before it', () => {
    const h = wealthHistory(accounts, txs, 'all', today)!;
    expect(h.points[0]).toEqual({ date: '2026-08-09', cents: 100000 });
    expect(h.points[h.points.length - 1].date).toBe(today);
    expect(h.points.every((p) => p.cents > 0)).toBe(true);
    // 6 months back would be April: clamped to the first data day.
    expect(wealthHistory(accounts, txs, '6m', today)!.points[0].date).toBe('2026-08-09');
  });

  it('matches the balances rebuilt from movements every day', () => {
    const h = wealthHistory(accounts, txs, '3m', today)!;
    for (const p of h.points) expect(p.cents).toBe(wealthAsOf(accounts, txs, p.date));
  });

  it('computes the stats of the range', () => {
    const { stats } = wealthHistory(accounts, txs, 'all', today)!;
    expect(stats.currentCents).toBe(100000 + 300000 + 150000 - 20000 - 5000);
    expect(stats.maxCents).toBe(550000);
    expect(stats.maxDate).toBe('2026-09-01');
    expect(stats.minCents).toBe(100000);
    // vs. the end of September.
    expect(stats.vsPreviousMonth.referenceDate).toBe('2026-09-30');
    expect(stats.vsPreviousMonth.diffCents).toBe(-5000);
    expect(stats.vsPreviousMonth.pct).toBeCloseTo((-5000 / 530000) * 100, 6);
  });

  it('is empty before any account starts', () => {
    expect(wealthHistory([], txs, '6m', today)).toBeNull();
    expect(wealthHistory([account({ id: 'x', initialBalanceDate: '2026-12-01' })], [], '6m', today)).toBeNull();
  });

  it('computes range starts', () => {
    expect(rangeStart('30d', today, '2020-01-01')).toBe('2026-09-10');
    expect(rangeStart('3m', today, '2020-01-01')).toBe('2026-07-09');
    expect(rangeStart('12m', '2024-02-29', '2020-01-01')).toBe('2023-02-28');
    expect(rangeStart('all', today, '2020-01-01')).toBe('2020-01-01');
  });

  it('samples long ranges weekly, keeping the last day', () => {
    const daily = Array.from({ length: 400 }, (_, i) => ({ date: String(i), cents: i }));
    const sampled = samplePoints(daily);
    expect(sampled.length).toBeLessThan(70);
    expect(sampled[sampled.length - 1]).toBe(daily[399]);
    expect(sampled[0]).toBe(daily[0]);
    expect(samplePoints(daily.slice(0, 100))).toHaveLength(100);
  });
});

describe('chart axes', () => {
  it('fits the Y axis to the data instead of starting at 0', () => {
    const { domain, ticks } = fittedDomain(500000, 560000);
    expect(domain[0]).toBeGreaterThan(0);
    expect(domain[0]).toBeLessThanOrEqual(500000);
    expect(domain[1]).toBeGreaterThanOrEqual(560000);
    expect(ticks.every((v) => v >= domain[0] && v <= domain[1])).toBe(true);
    // From 2.000 € to 13.000 € the axis still doesn't start at 0 €.
    const wide = fittedDomain(200000, 1300000);
    expect(wide.domain[0]).toBeGreaterThan(0);
    expect(wide.ticks[0]).toBeGreaterThan(0);
    // A flat line still gets a window around it.
    const flat = fittedDomain(100000, 100000);
    expect(flat.domain[0]).toBeLessThan(100000);
    expect(flat.domain[1]).toBeGreaterThan(100000);
  });

  it('bars include zero', () => {
    expect(zeroBasedDomain(-3000, 12000).domain[0]).toBeLessThanOrEqual(-3000);
    expect(zeroBasedDomain(5000, 12000).domain[0]).toBe(0);
  });
});
