/**
 * Cash flow: income and expenses only. Transfers move money between my own accounts, so they are
 * never income or expense and never count towards the balance, the savings rate or budgets.
 */
import { monthOf, type ISODate, type MonthKey } from '../dates';
import type { Transaction } from '../types';

type TxLike = Pick<Transaction, 'type' | 'amountCents' | 'date' | 'categoryId'>;

export interface FlowTotals {
  incomeCents: number;
  expenseCents: number;
  /** income - expenses. */
  balanceCents: number;
  expenseCount: number;
  incomeCount: number;
}

export function flowTotals(txs: Iterable<TxLike>): FlowTotals {
  let incomeCents = 0;
  let expenseCents = 0;
  let expenseCount = 0;
  let incomeCount = 0;
  for (const tx of txs) {
    if (tx.type === 'income') {
      incomeCents += tx.amountCents;
      incomeCount++;
    } else if (tx.type === 'expense') {
      expenseCents += tx.amountCents;
      expenseCount++;
    }
  }
  return { incomeCents, expenseCents, balanceCents: incomeCents - expenseCents, expenseCount, incomeCount };
}

export function inMonth<T extends { date: ISODate }>(txs: Iterable<T>, month: MonthKey): T[] {
  const out: T[] = [];
  for (const tx of txs) if (monthOf(tx.date) === month) out.push(tx);
  return out;
}

export function monthTotals(txs: Iterable<TxLike>, month: MonthKey): FlowTotals {
  return flowTotals(inMonth(txs, month));
}

/** Savings rate = balance ÷ income, in %. Null when there is no income (it would be meaningless). */
export function savingsRate(incomeCents: number, balanceCents: number): number | null {
  if (incomeCents <= 0) return null;
  return (balanceCents / incomeCents) * 100;
}

export interface CategoryAmount {
  categoryId: string;
  cents: number;
}

/** Expenses per category, largest first. */
export function expensesByCategory(txs: Iterable<TxLike>): CategoryAmount[] {
  const totals = new Map<string, number>();
  for (const tx of txs) {
    if (tx.type !== 'expense' || !tx.categoryId) continue;
    totals.set(tx.categoryId, (totals.get(tx.categoryId) ?? 0) + tx.amountCents);
  }
  return [...totals.entries()].map(([categoryId, cents]) => ({ categoryId, cents })).sort((a, b) => b.cents - a.cents);
}

export interface MonthFlow extends FlowTotals {
  month: MonthKey;
  savingsRate: number | null;
}

/** Totals for each of the given months, in a single pass. */
export function monthlyFlows(txs: Iterable<TxLike>, months: readonly MonthKey[]): MonthFlow[] {
  const byMonth = new Map<MonthKey, TxLike[]>(months.map((m) => [m, []]));
  for (const tx of txs) byMonth.get(monthOf(tx.date))?.push(tx);
  return months.map((month) => {
    const totals = flowTotals(byMonth.get(month) ?? []);
    return { month, ...totals, savingsRate: savingsRate(totals.incomeCents, totals.balanceCents) };
  });
}

export interface Delta {
  diffCents: number;
  /** Change relative to the previous value, in %. Null when the previous value is 0. */
  pct: number | null;
}

export function delta(current: number, previous: number): Delta {
  const diffCents = current - previous;
  return { diffCents, pct: previous === 0 ? null : (diffCents / Math.abs(previous)) * 100 };
}

export interface CategoryComparison {
  categoryId: string;
  previousCents: number;
  currentCents: number;
  diffCents: number;
}

/** Expense per category this month vs. the previous one, sorted by this month's amount. */
export function compareCategories(current: Iterable<TxLike>, previous: Iterable<TxLike>): CategoryComparison[] {
  const cur = new Map(expensesByCategory(current).map((c) => [c.categoryId, c.cents]));
  const prev = new Map(expensesByCategory(previous).map((c) => [c.categoryId, c.cents]));
  const ids = new Set([...cur.keys(), ...prev.keys()]);
  return [...ids]
    .map((categoryId) => {
      const currentCents = cur.get(categoryId) ?? 0;
      const previousCents = prev.get(categoryId) ?? 0;
      return { categoryId, currentCents, previousCents, diffCents: currentCents - previousCents };
    })
    .sort((a, b) => b.currentCents - a.currentCents || b.previousCents - a.previousCents);
}
