/**
 * Budgets are informative only: they never block a movement.
 * A month uses its own budget if it has one, otherwise the default budget.
 */
import type { MonthKey } from '../dates';
import type { Budget } from '../types';
import type { CategoryAmount } from './cashflow';

export type BudgetSource = 'custom' | 'default' | 'none';

export function resolveBudget(budgets: readonly Budget[], month: MonthKey): { budget: Budget | null; source: BudgetSource } {
  const custom = budgets.find((b) => b.month === month);
  if (custom) return { budget: custom, source: 'custom' };
  const fallback = budgets.find((b) => b.month === 'default');
  if (fallback) return { budget: fallback, source: 'default' };
  return { budget: null, source: 'none' };
}

/** ok: < 80 % · near: 80–99 % · over: ≥ 100 %. */
export type BudgetLevel = 'ok' | 'near' | 'over';

export function budgetLevel(spentCents: number, budgetCents: number): BudgetLevel {
  if (budgetCents <= 0) return 'ok';
  // Integer comparisons: no rounding at the 80 % / 100 % boundaries.
  if (spentCents >= budgetCents) return 'over';
  if (spentCents * 100 >= budgetCents * 80) return 'near';
  return 'ok';
}

export interface BudgetLine {
  /** null = the monthly total. */
  categoryId: string | null;
  spentCents: number;
  budgetCents: number;
  pct: number;
  remainingCents: number;
  level: BudgetLevel;
}

function line(categoryId: string | null, spentCents: number, budgetCents: number): BudgetLine {
  return {
    categoryId,
    spentCents,
    budgetCents,
    pct: budgetCents > 0 ? (spentCents / budgetCents) * 100 : 0,
    remainingCents: budgetCents - spentCents,
    level: budgetLevel(spentCents, budgetCents),
  };
}

export interface BudgetReport {
  total: BudgetLine | null;
  categories: BudgetLine[];
}

/** Progress of each budgeted category (and of the total) against the month's expenses. */
export function budgetReport(budget: Budget | null, expenses: readonly CategoryAmount[], totalExpenseCents: number): BudgetReport {
  if (!budget) return { total: null, categories: [] };
  const spent = new Map(expenses.map((e) => [e.categoryId, e.cents]));
  const categories = Object.entries(budget.perCategory)
    .filter(([, cents]) => cents > 0)
    .map(([categoryId, cents]) => line(categoryId, spent.get(categoryId) ?? 0, cents))
    .sort((a, b) => b.pct - a.pct);
  const total = budget.totalCents && budget.totalCents > 0 ? line(null, totalExpenseCents, budget.totalCents) : null;
  return { total, categories };
}
