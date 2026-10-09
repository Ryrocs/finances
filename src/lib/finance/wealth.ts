/**
 * Liquid-wealth history, always rebuilt from initial balances + movements (no stored snapshots),
 * so it stays right when an old movement is edited.
 */
import { addDays, addMonths, clampDay, diffDays, maxDate, monthOf, monthStart, parseISODate, type ISODate } from '../dates';
import type { Account, Transaction } from '../types';
import { dailyBalances, earliestStart, type DailyPoint } from './balances';
import { delta, type Delta } from './cashflow';

export type WealthRange = '30d' | '3m' | '6m' | '12m' | 'all';

export const WEALTH_RANGES: WealthRange[] = ['30d', '3m', '6m', '12m', 'all'];

/** Above this many days the chart uses one point per week. */
export const WEEKLY_SAMPLING_FROM_DAYS = 200;

export function rangeStart(range: WealthRange, today: ISODate, earliest: ISODate): ISODate {
  let from: ISODate;
  if (range === '30d') from = addDays(today, -29);
  else if (range === 'all') from = earliest;
  else {
    // Same day N months ago (clamped: 31 May - 3 months → 28/29 Feb).
    const months = range === '3m' ? 3 : range === '6m' ? 6 : 12;
    from = clampDay(addMonths(monthOf(today), -months), parseISODate(today).d);
  }
  // Before the earliest initial balance there is no data: the chart starts there, not at 0 €.
  return maxDate(from, earliest);
}

/** Keeps one point per week (ending exactly on the last day) for long ranges. */
export function samplePoints(points: DailyPoint[]): DailyPoint[] {
  if (points.length <= WEEKLY_SAMPLING_FROM_DAYS) return points;
  const out: DailyPoint[] = [];
  for (let i = points.length - 1; i >= 0; i -= 7) out.push(points[i]);
  if (out[out.length - 1] !== points[0]) out.push(points[0]);
  return out.reverse();
}

export interface WealthStats {
  currentCents: number;
  maxCents: number;
  maxDate: ISODate;
  minCents: number;
  minDate: ISODate;
  /** Today vs. the end of the previous month. */
  vsPreviousMonth: Delta & { referenceDate: ISODate; referenceCents: number };
}

export interface WealthHistory {
  points: DailyPoint[];
  stats: WealthStats;
}

type AccountLike = Pick<Account, 'id' | 'initialBalanceCents' | 'initialBalanceDate'>;
type TxLike = Pick<Transaction, 'type' | 'amountCents' | 'accountId' | 'toAccountId' | 'date'>;

export function wealthHistory(accounts: readonly AccountLike[], txs: readonly TxLike[], range: WealthRange, today: ISODate): WealthHistory | null {
  const earliest = earliestStart(accounts);
  if (!earliest || earliest > today) return null;
  const from = rangeStart(range, today, earliest);
  const daily = dailyBalances(accounts, txs, from, today);

  let max = daily[0];
  let min = daily[0];
  for (const p of daily) {
    if (p.cents > max.cents) max = p;
    if (p.cents < min.cents) min = p;
  }
  const current = daily[daily.length - 1].cents;

  const referenceDate = addDays(monthStart(monthOf(today)), -1);
  const referenceCents =
    referenceDate < earliest ? 0 : (dailyBalances(accounts, txs, referenceDate, referenceDate)[0]?.cents ?? 0);

  return {
    points: samplePoints(daily),
    stats: {
      currentCents: current,
      maxCents: max.cents,
      maxDate: max.date,
      minCents: min.cents,
      minDate: min.date,
      vsPreviousMonth: { ...delta(current, referenceCents), referenceDate, referenceCents },
    },
  };
}

/** Number of days a range covers (for labels/tests). */
export function rangeDays(range: WealthRange, today: ISODate, earliest: ISODate): number {
  return diffDays(rangeStart(range, today, earliest), today) + 1;
}
