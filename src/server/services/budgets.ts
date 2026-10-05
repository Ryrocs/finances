import 'server-only';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { daysInMonthKey, diffDays, monthEnd, monthOf, monthStart } from '@/lib/dates';
import { budgetStatus } from '@/lib/finance/budget';
import type { BudgetDTO, BudgetOverviewDTO, CategoryAmount } from '@/lib/types';
import { getDb } from '../db';
import { budgets, transactions, type BudgetRow } from '../db/schema';
import { notFound, validationError } from '../http';
import { getCategory } from './categories';

function toBudgetDTO(row: BudgetRow): BudgetDTO {
  return { id: row.id, categoryId: row.categoryId, amountCents: row.amountCents, isDemo: row.isDemo };
}

export async function listBudgets(userId: string): Promise<BudgetDTO[]> {
  const rows = await getDb().select().from(budgets).where(eq(budgets.userId, userId)).orderBy(budgets.createdAt);
  return rows.map(toBudgetDTO);
}

/** Creates or replaces the overall budget (categoryId null) or a category budget. */
export async function upsertBudget(userId: string, input: { categoryId: string | null; amountCents: number }): Promise<BudgetDTO> {
  if (input.categoryId) {
    const cat = await getCategory(userId, input.categoryId).catch(() => null);
    if (!cat || cat.kind !== 'expense' || cat.archivedAt) throw validationError({ categoryId: 'invalid' });
  }
  const [row] = await getDb()
    .insert(budgets)
    .values({ userId, categoryId: input.categoryId, amountCents: input.amountCents })
    .onConflictDoUpdate({
      target: [budgets.userId, budgets.categoryId],
      set: { amountCents: input.amountCents, isDemo: false, updatedAt: new Date() },
    })
    .returning();
  return toBudgetDTO(row);
}

export async function deleteBudget(userId: string, id: string): Promise<void> {
  const result = await getDb()
    .delete(budgets)
    .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
    .returning({ id: budgets.id });
  if (!result.length) throw notFound();
}

export async function expensesByCategory(userId: string, month: string): Promise<CategoryAmount[]> {
  const rows = await getDb()
    .select({
      categoryId: transactions.categoryId,
      amount: sql<string>`sum(${transactions.amountCents})`,
      count: sql<string>`count(*)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, 'expense'),
        gte(transactions.date, monthStart(month)),
        lte(transactions.date, monthEnd(month)),
      ),
    )
    .groupBy(transactions.categoryId);
  return rows
    .filter((r) => r.categoryId)
    .map((r) => ({ categoryId: r.categoryId as string, amountCents: Number(r.amount), count: Number(r.count) }))
    .sort((a, b) => b.amountCents - a.amountCents);
}

export function buildBudgetOverview(
  month: string,
  today: string,
  budgetRows: BudgetDTO[],
  spentByCategory: CategoryAmount[],
): BudgetOverviewDTO {
  const spent = new Map(spentByCategory.map((c) => [c.categoryId, c.amountCents]));
  const total = spentByCategory.reduce((s, c) => s + c.amountCents, 0);
  const overallRow = budgetRows.find((b) => b.categoryId === null);
  const categoryRows = budgetRows.filter((b) => b.categoryId !== null);
  const budgetedIds = new Set(categoryRows.map((b) => b.categoryId as string));
  const unbudgeted = spentByCategory.filter((c) => !budgetedIds.has(c.categoryId)).reduce((s, c) => s + c.amountCents, 0);

  const current = monthOf(today);
  const daysLeft = month < current ? 0 : month > current ? daysInMonthKey(month) : diffDays(today, monthEnd(month)) + 1;

  return {
    month,
    overall: overallRow ? { id: overallRow.id, categoryId: null, ...budgetStatus(total, overallRow.amountCents) } : null,
    categories: categoryRows
      .map((b) => ({ id: b.id, categoryId: b.categoryId, ...budgetStatus(spent.get(b.categoryId as string) ?? 0, b.amountCents) }))
      .sort((a, b) => b.percent - a.percent),
    unbudgetedSpentCents: unbudgeted,
    totalSpentCents: total,
    daysLeft,
  };
}

export async function budgetOverview(userId: string, month: string, today: string): Promise<BudgetOverviewDTO> {
  const [rows, spent] = await Promise.all([listBudgets(userId), expensesByCategory(userId, month)]);
  return buildBudgetOverview(month, today, rows, spent);
}
