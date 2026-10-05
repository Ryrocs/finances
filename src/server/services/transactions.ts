import 'server-only';
import { and, desc, eq, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';
import { monthEnd, monthOf, monthStart } from '@/lib/dates';
import { budgetStatus } from '@/lib/finance/budget';
import { parseAmountToCents } from '@/lib/money';
import type { BudgetAlert, TransactionDTO, TransactionListDTO, TransactionType } from '@/lib/types';
import type { TransactionInput } from '@/lib/validation';
import { getDb } from '../db';
import { accounts, budgets, categories, transactions, type TransactionRow } from '../db/schema';
import { notFound, validationError } from '../http';

export function toTransactionDTO(row: TransactionRow): TransactionDTO {
  return {
    id: row.id,
    type: row.type as TransactionType,
    amountCents: row.amountCents,
    date: row.date,
    accountId: row.accountId,
    toAccountId: row.toAccountId,
    categoryId: row.categoryId,
    description: row.description,
    notes: row.notes,
    recurringId: row.recurringId,
    isDemo: row.isDemo,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface TransactionFilters {
  month?: string;
  from?: string;
  to?: string;
  type?: TransactionType;
  accountId?: string;
  categoryId?: string;
  q?: string;
  /** Category ids whose *translated* label matches q (computed by the client). */
  matchCategoryIds?: string[];
  cursor?: string;
  limit?: number;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function encodeCursor(row: { date: string; createdAtText: string; id: string }): string {
  return Buffer.from(JSON.stringify([row.date, row.createdAtText, row.id])).toString('base64url');
}

function decodeCursor(cursor: string): [string, string, string] | null {
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (Array.isArray(value) && value.length === 3 && value.every((v) => typeof v === 'string')) return value as [string, string, string];
  } catch {
    // ignore
  }
  return null;
}

function filterConditions(userId: string, f: TransactionFilters): SQL[] {
  const conds: SQL[] = [eq(transactions.userId, userId)];
  if (f.month) {
    conds.push(gte(transactions.date, monthStart(f.month)), lte(transactions.date, monthEnd(f.month)));
  }
  if (f.from) conds.push(gte(transactions.date, f.from));
  if (f.to) conds.push(lte(transactions.date, f.to));
  if (f.type) conds.push(eq(transactions.type, f.type));
  if (f.accountId) conds.push(sql`(${transactions.accountId} = ${f.accountId} or ${transactions.toAccountId} = ${f.accountId})`);
  if (f.categoryId) conds.push(eq(transactions.categoryId, f.categoryId));
  const q = f.q?.trim();
  if (q) {
    const like = `%${escapeLike(q)}%`;
    const parts: SQL[] = [sql`${transactions.description} ilike ${like}`, sql`coalesce(${transactions.notes}, '') ilike ${like}`];
    if (f.matchCategoryIds?.length) parts.push(inArray(transactions.categoryId, f.matchCategoryIds));
    const amount = parseAmountToCents(q);
    if (amount !== null && amount > 0) parts.push(eq(transactions.amountCents, amount));
    parts.push(sql`exists (select 1 from ${accounts} a where a.user_id = ${userId}
      and (a.id = ${transactions.accountId} or a.id = ${transactions.toAccountId}) and a.name ilike ${like})`);
    parts.push(sql`exists (select 1 from ${categories} c where c.user_id = ${userId}
      and c.id = ${transactions.categoryId} and c.name ilike ${like})`);
    conds.push(sql`(${sql.join(parts, sql` or `)})`);
  }
  return conds;
}

export async function listTransactions(userId: string, filters: TransactionFilters): Promise<TransactionListDTO> {
  const db = getDb();
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const conds = filterConditions(userId, filters);
  const pageConds = [...conds];
  if (filters.cursor) {
    const c = decodeCursor(filters.cursor);
    if (!c) throw validationError({ cursor: 'invalid' });
    pageConds.push(sql`(${transactions.date}, ${transactions.createdAt}, ${transactions.id}) < (${c[0]}::date, ${c[1]}::timestamptz, ${c[2]}::uuid)`);
  }

  const rowsPromise = db
    .select({ tx: transactions, createdAtText: sql<string>`${transactions.createdAt}::text` })
    .from(transactions)
    .where(and(...pageConds))
    .orderBy(desc(transactions.date), desc(transactions.createdAt), desc(transactions.id))
    .limit(limit + 1);

  // Totals for the whole filtered set (first page only).
  const totalsPromise = filters.cursor
    ? Promise.resolve(null)
    : db
        .select({
          count: sql<string>`count(*)`,
          income: sql<string>`coalesce(sum(${transactions.amountCents}) filter (where ${transactions.type} = 'income'), 0)`,
          expense: sql<string>`coalesce(sum(${transactions.amountCents}) filter (where ${transactions.type} = 'expense'), 0)`,
        })
        .from(transactions)
        .where(and(...conds));

  const [rows, totals] = await Promise.all([rowsPromise, totalsPromise]);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    items: page.map((r) => toTransactionDTO(r.tx)),
    nextCursor: hasMore && last ? encodeCursor({ date: last.tx.date, createdAtText: last.createdAtText, id: last.tx.id }) : null,
    totals: totals
      ? { count: Number(totals[0].count), incomeCents: Number(totals[0].income), expenseCents: Number(totals[0].expense) }
      : { count: -1, incomeCents: 0, expenseCents: 0 },
  };
}

export async function getTransaction(userId: string, id: string): Promise<TransactionRow> {
  const [row] = await getDb()
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .limit(1);
  if (!row) throw notFound();
  return row;
}

/**
 * Checks that referenced accounts/categories belong to the user and that the category kind
 * matches the movement type. (The composite foreign keys enforce ownership again in the DB.)
 */
export async function assertReferences(
  userId: string,
  input: { type: TransactionType; accountId: string; toAccountId?: string | null; categoryId?: string | null },
): Promise<void> {
  const db = getDb();
  const accountIds = [input.accountId, input.toAccountId].filter((v): v is string => !!v);
  const owned = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), inArray(accounts.id, accountIds)));
  const ownedIds = new Set(owned.map((a) => a.id));
  const errors: Record<string, string> = {};
  if (!ownedIds.has(input.accountId)) errors.accountId = 'invalid';
  if (input.toAccountId && !ownedIds.has(input.toAccountId)) errors.toAccountId = 'invalid';
  if (input.type !== 'transfer') {
    if (!input.categoryId) errors.categoryId = 'required';
    else {
      const [cat] = await db
        .select({ kind: categories.kind })
        .from(categories)
        .where(and(eq(categories.id, input.categoryId), eq(categories.userId, userId)))
        .limit(1);
      if (!cat || cat.kind !== input.type) errors.categoryId = 'invalid';
    }
  }
  if (Object.keys(errors).length) throw validationError(errors);
}

function valuesFrom(input: TransactionInput) {
  return {
    type: input.type,
    amountCents: input.amountCents,
    date: input.date,
    accountId: input.accountId,
    toAccountId: input.type === 'transfer' ? input.toAccountId : null,
    categoryId: input.type === 'transfer' ? null : input.categoryId,
    description: input.description,
    notes: input.notes,
  };
}

/** Budget warnings triggered by an expense — informational only, never blocking. */
export async function budgetAlertsFor(userId: string, date: string, categoryId: string | null): Promise<BudgetAlert[]> {
  const db = getDb();
  const month = monthOf(date);
  const relevant = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.userId, userId), categoryId ? sql`(${budgets.categoryId} is null or ${budgets.categoryId} = ${categoryId})` : sql`${budgets.categoryId} is null`));
  if (!relevant.length) return [];
  const [spent] = await db
    .select({
      total: sql<string>`coalesce(sum(${transactions.amountCents}), 0)`,
      inCategory: categoryId
        ? sql<string>`coalesce(sum(${transactions.amountCents}) filter (where ${transactions.categoryId} = ${categoryId}), 0)`
        : sql<string>`0`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, 'expense'),
        gte(transactions.date, monthStart(month)),
        lte(transactions.date, monthEnd(month)),
      ),
    );
  const alerts: BudgetAlert[] = [];
  for (const b of relevant) {
    const status = budgetStatus(Number(b.categoryId ? spent.inCategory : spent.total), b.amountCents);
    if (status.level !== 'ok') {
      alerts.push({ categoryId: b.categoryId, level: status.level, percent: status.percent, remainingCents: status.remainingCents });
    }
  }
  return alerts;
}

export async function createTransaction(userId: string, input: TransactionInput) {
  await assertReferences(userId, {
    type: input.type,
    accountId: input.accountId,
    toAccountId: input.type === 'transfer' ? input.toAccountId : null,
    categoryId: input.type === 'transfer' ? null : input.categoryId,
  });
  const [row] = await getDb()
    .insert(transactions)
    .values({ userId, ...valuesFrom(input) })
    .returning();
  const budgetAlerts = row.type === 'expense' ? await budgetAlertsFor(userId, row.date, row.categoryId) : [];
  return { transaction: toTransactionDTO(row), budgetAlerts };
}

export async function updateTransaction(userId: string, id: string, input: TransactionInput) {
  await getTransaction(userId, id);
  await assertReferences(userId, {
    type: input.type,
    accountId: input.accountId,
    toAccountId: input.type === 'transfer' ? input.toAccountId : null,
    categoryId: input.type === 'transfer' ? null : input.categoryId,
  });
  // recurring_id / occurrence_date are kept, so editing a generated occurrence never re-creates it.
  const [row] = await getDb()
    .update(transactions)
    .set({ ...valuesFrom(input), updatedAt: new Date() })
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .returning();
  const budgetAlerts = row.type === 'expense' ? await budgetAlertsFor(userId, row.date, row.categoryId) : [];
  return { transaction: toTransactionDTO(row), budgetAlerts };
}

export async function deleteTransaction(userId: string, id: string): Promise<void> {
  const result = await getDb()
    .delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .returning({ id: transactions.id });
  if (!result.length) throw notFound();
}

export async function recentTransactions(userId: string, from: string, to: string, limit = 5): Promise<TransactionDTO[]> {
  const rows = await getDb()
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), gte(transactions.date, from), lte(transactions.date, to)))
    .orderBy(desc(transactions.date), desc(transactions.createdAt), desc(transactions.id))
    .limit(limit);
  return rows.map(toTransactionDTO);
}
