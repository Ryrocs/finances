/**
 * Spending-rate projection for the current month.
 *
 *   projected = fixed + variable / daysElapsed × daysInMonth
 *
 * "fixed" are expenses produced by recurring rules (rent, subscriptions…). They happen once
 * per month, so extrapolating them would wildly overestimate spending early in the month.
 * Without recurring rules this is exactly: spent / days elapsed × days in month.
 */
import { daysInMonthKey, monthOf, parseISODate } from '../dates';
import type { ProjectionDTO, ProjectionReference } from '../types';

/** The projection is hidden until this many days of the month have elapsed. */
export const MIN_DAYS_FOR_PROJECTION = 5;
/** Spending above usual by more than this ratio is flagged as unusually high. */
export const HIGH_VS_AVERAGE_RATIO = 1.15;

export interface ProjectionInput {
  month: string;
  today: string;
  /** Expenses so far this month not created by recurring rules. */
  variableCents: number;
  /** Expenses so far this month created by recurring rules. */
  fixedCents: number;
  /** Recurring expenses still scheduled later this month. */
  pendingFixedCents?: number;
  /** Overall monthly budget, if any. */
  budgetCents?: number | null;
  /** Average monthly expenses of previous months that have data. */
  averageCents?: number | null;
  incomeCents?: number;
}

export function projectSpending(input: ProjectionInput): ProjectionDTO {
  const daysInMonth = daysInMonthKey(input.month);
  const currentMonth = monthOf(input.today);
  const spent = input.variableCents + input.fixedCents;
  const base: ProjectionDTO = {
    status: 'available',
    projectedCents: spent,
    dailyRateCents: 0,
    daysElapsed: 0,
    daysInMonth,
    fixedCents: input.fixedCents,
    variableCents: input.variableCents,
    reference: null,
    referenceCents: 0,
    high: false,
  };

  if (input.month < currentMonth) {
    return { ...base, status: 'past', daysElapsed: daysInMonth, dailyRateCents: Math.round(spent / daysInMonth) };
  }
  if (input.month > currentMonth) {
    return { ...base, status: 'future', projectedCents: 0 };
  }

  const daysElapsed = parseISODate(input.today).d;
  const dailyRate = Math.round(input.variableCents / daysElapsed);
  if (daysElapsed < MIN_DAYS_FOR_PROJECTION) {
    return { ...base, status: 'too_early', daysElapsed, dailyRateCents: dailyRate };
  }

  const fixedTotal = input.fixedCents + (input.pendingFixedCents ?? 0);
  // Integer arithmetic: multiply before dividing, round once.
  const projected = fixedTotal + Math.round((input.variableCents * daysInMonth) / daysElapsed);

  let reference: ProjectionReference | null = null;
  let referenceCents = 0;
  let high = false;
  if (input.budgetCents && input.budgetCents > 0) {
    reference = 'budget';
    referenceCents = input.budgetCents;
    high = projected > input.budgetCents;
  } else if (input.averageCents && input.averageCents > 0) {
    reference = 'average';
    referenceCents = input.averageCents;
    high = projected > input.averageCents * HIGH_VS_AVERAGE_RATIO;
  } else if (input.incomeCents && input.incomeCents > 0) {
    reference = 'income';
    referenceCents = input.incomeCents;
    high = projected > input.incomeCents;
  }

  return {
    ...base,
    status: 'available',
    projectedCents: projected,
    dailyRateCents: dailyRate,
    daysElapsed,
    reference,
    referenceCents,
    high,
  };
}
