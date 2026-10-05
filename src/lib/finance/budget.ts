import type { BudgetLevel, BudgetStatus } from '../types';

/** From this share of the budget on, the user is warned that it's nearly exhausted. */
export const BUDGET_WARNING_RATIO = 0.8;

export function budgetLevel(spentCents: number, budgetCents: number): BudgetLevel {
  if (budgetCents <= 0) return spentCents > 0 ? 'exceeded' : 'ok';
  if (spentCents > budgetCents) return 'exceeded';
  if (spentCents >= budgetCents * BUDGET_WARNING_RATIO) return 'warning';
  return 'ok';
}

export function budgetStatus(spentCents: number, budgetCents: number): BudgetStatus {
  return {
    budgetCents,
    spentCents,
    remainingCents: budgetCents - spentCents,
    percent: budgetCents > 0 ? Math.round((spentCents / budgetCents) * 100) : 0,
    level: budgetLevel(spentCents, budgetCents),
  };
}

/** How much can still be spent per remaining day (0 if nothing is left). */
export function dailyAllowance(remainingCents: number, daysLeft: number): number {
  if (remainingCents <= 0 || daysLeft <= 0) return 0;
  return Math.floor(remainingCents / daysLeft);
}
