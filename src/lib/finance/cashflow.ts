/**
 * Cash flow = income and expenses. Transfers are excluded by definition.
 */
import type { CategoryAmount, CategoryGroup, TransactionType } from '../types';

export interface CashFlowRow {
  type: TransactionType;
  amountCents: number;
  categoryId: string | null;
  /** Number of movements represented by this row (1 for a raw movement). */
  count?: number;
}

export interface CashFlowSummary {
  incomeCents: number;
  expenseCents: number;
  /** income − expenses; negative means spending exceeded income. */
  balanceCents: number;
  count: number;
}

export function summarizeCashFlow(rows: Iterable<CashFlowRow>): CashFlowSummary {
  let income = 0;
  let expense = 0;
  let count = 0;
  for (const r of rows) {
    if (r.type === 'income') income += r.amountCents;
    else if (r.type === 'expense') expense += r.amountCents;
    else continue;
    count += r.count ?? 1;
  }
  return { incomeCents: income, expenseCents: expense, balanceCents: income - expense, count };
}

/** Totals per category for one movement type, sorted by amount (largest first). */
export function totalsByCategory(rows: Iterable<CashFlowRow>, type: 'expense' | 'income'): CategoryAmount[] {
  const map = new Map<string, CategoryAmount>();
  for (const r of rows) {
    if (r.type !== type || !r.categoryId) continue;
    const entry = map.get(r.categoryId) ?? { categoryId: r.categoryId, amountCents: 0, count: 0 };
    entry.amountCents += r.amountCents;
    entry.count += r.count ?? 1;
    map.set(r.categoryId, entry);
  }
  return [...map.values()].sort((a, b) => b.amountCents - a.amountCents || a.categoryId.localeCompare(b.categoryId));
}

export function groupTotals(
  byCategory: Iterable<CategoryAmount>,
  groupOf: (categoryId: string) => CategoryGroup | undefined,
): Record<'needs' | 'lifestyle' | 'other', number> {
  const totals = { needs: 0, lifestyle: 0, other: 0 };
  for (const c of byCategory) {
    const g = groupOf(c.categoryId);
    if (g === 'needs' || g === 'lifestyle') totals[g] += c.amountCents;
    else totals.other += c.amountCents;
  }
  return totals;
}

export interface Comparison {
  fromCents: number;
  toCents: number;
  diffCents: number;
  /** Percentage change relative to `from` (1 decimal), null when `from` is 0. */
  percent: number | null;
}

/** Compare two amounts, e.g. September €421 → October €476: +€55, +13.1 %. */
export function compareAmounts(fromCents: number, toCents: number): Comparison {
  const diff = toCents - fromCents;
  const percent = fromCents === 0 ? null : Math.round((diff / Math.abs(fromCents)) * 1000) / 10;
  return { fromCents, toCents, diffCents: diff, percent };
}

export interface CategoryComparison extends Comparison {
  categoryId: string;
}

/** Per-category comparison between two month maps (categoryId → cents), largest change first. */
export function compareCategories(from: Record<string, number>, to: Record<string, number>): CategoryComparison[] {
  const ids = new Set([...Object.keys(from), ...Object.keys(to)]);
  return [...ids]
    .map((id) => ({ categoryId: id, ...compareAmounts(from[id] ?? 0, to[id] ?? 0) }))
    .filter((c) => c.fromCents !== 0 || c.toCents !== 0)
    .sort((a, b) => Math.abs(b.diffCents) - Math.abs(a.diffCents) || b.toCents - a.toCents);
}
