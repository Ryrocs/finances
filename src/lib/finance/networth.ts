/**
 * Historical liquid wealth, reconstructed from initial balances and movements — never by
 * repeating today's balance for past dates.
 */
import { addDays, addMonthsClamped, diffDays, minISO } from '../dates';
import type { NetWorthPeriod, NetWorthPoint } from '../types';

export interface InitialBalance {
  date: string;
  cents: number;
}

export interface DailyDelta {
  date: string;
  /** Net change of liquid wealth caused by movements dated that day. */
  cents: number;
}

/** First date of a period ending today. `all` starts at the earliest data point. */
export function periodStart(period: NetWorthPeriod, today: string, earliest: string | null): string {
  switch (period) {
    case '30d':
      return addDays(today, -29);
    case '3m':
      return addMonthsClamped(today, -3);
    case '6m':
      return addMonthsClamped(today, -6);
    case '12m':
      return addMonthsClamped(today, -12);
    case 'all':
      return earliest ? minISO(earliest, today) : addDays(today, -29);
  }
}

/** Value at the end of `date`. */
export function valueAt(date: string, initials: InitialBalance[], deltas: DailyDelta[]): number {
  let total = 0;
  for (const i of initials) if (i.date <= date) total += i.cents;
  for (const d of deltas) if (d.date <= date) total += d.cents;
  return total;
}

/** Keeps the series readable on a phone: at most ~120 points, always including first & last day. */
function stepFor(days: number): number {
  if (days <= 120) return 1;
  return Math.ceil(days / 120);
}

/**
 * Daily series from `from` to `to` (inclusive), downsampled for long ranges.
 * Each point is the exact end-of-day value (no interpolation).
 */
export function buildNetWorthSeries(
  initials: InitialBalance[],
  deltas: DailyDelta[],
  from: string,
  to: string,
): NetWorthPoint[] {
  if (from > to) return [];
  const changes = new Map<string, number>();
  let running = 0;
  for (const i of initials) {
    if (i.date <= from) running += i.cents;
    else changes.set(i.date, (changes.get(i.date) ?? 0) + i.cents);
  }
  for (const d of deltas) {
    if (d.date <= from) running += d.cents;
    else changes.set(d.date, (changes.get(d.date) ?? 0) + d.cents);
  }

  const days = diffDays(from, to) + 1;
  const step = stepFor(days);
  const points: NetWorthPoint[] = [];
  let date = from;
  for (let i = 0; i < days; i++) {
    if (i > 0) {
      date = addDays(date, 1);
      running += changes.get(date) ?? 0;
    }
    if (i === 0 || i === days - 1 || i % step === 0) points.push({ date, cents: running });
  }
  return points;
}

/** Earliest date with data (initial balance or movement). */
export function earliestDate(initials: InitialBalance[], deltas: DailyDelta[]): string | null {
  let earliest: string | null = null;
  for (const d of [...initials, ...deltas]) earliest = earliest === null ? d.date : minISO(earliest, d.date);
  return earliest;
}
