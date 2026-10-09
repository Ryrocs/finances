/**
 * Spending pace for the current month.
 *
 *   projection = spent so far ÷ days elapsed × days in the month
 *
 * Hidden before day 5 or with fewer than 3 expenses: too little data to extrapolate.
 */
import { daysInMonthKey, monthOf, parseISODate, type ISODate, type MonthKey } from '../dates';

export const PACE_MIN_DAY = 5;
export const PACE_MIN_EXPENSES = 3;
/** Warn when the budget used runs ahead of the month elapsed by more than this many points. */
export const PACE_WARNING_POINTS = 10;

export interface PaceInput {
  month: MonthKey;
  today: ISODate;
  spentCents: number;
  expenseCount: number;
  /** Overall monthly budget, if defined. */
  budgetCents?: number | null;
}

export interface Pace {
  daysElapsed: number;
  daysInMonth: number;
  spentCents: number;
  projectedCents: number;
  /** % of the month elapsed. */
  monthPct: number;
  /** % of the total budget spent (null without a budget). */
  budgetPct: number | null;
  /** Spending faster than planned. */
  warning: boolean;
}

export function spendingPace(input: PaceInput): Pace | null {
  if (input.month !== monthOf(input.today)) return null;
  const daysElapsed = parseISODate(input.today).d;
  if (daysElapsed < PACE_MIN_DAY || input.expenseCount < PACE_MIN_EXPENSES) return null;
  const daysInMonth = daysInMonthKey(input.month);
  const projectedCents = Math.round((input.spentCents * daysInMonth) / daysElapsed);
  const monthPct = (daysElapsed / daysInMonth) * 100;
  const budgetPct = input.budgetCents && input.budgetCents > 0 ? (input.spentCents / input.budgetCents) * 100 : null;
  return {
    daysElapsed,
    daysInMonth,
    spentCents: input.spentCents,
    projectedCents,
    monthPct,
    budgetPct,
    warning: budgetPct !== null && budgetPct - monthPct > PACE_WARNING_POINTS,
  };
}
