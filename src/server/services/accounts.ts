import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { accountBalance } from '@/lib/finance/balances';
import type { AccountDTO, AccountType } from '@/lib/types';
import type { accountSchema, accountUpdateSchema } from '@/lib/validation';
import type { z } from 'zod';
import { getDb } from '../db';
import { accounts, type AccountRow } from '../db/schema';
import { notFound } from '../http';

interface BalanceRow extends Record<string, unknown> {
  id: string;
  initial_applies: boolean;
  income: string;
  expense: string;
  transfer_out: string;
  transfer_in: string;
  tx_count: string;
}

function toAccountDTO(row: AccountRow, balanceCents: number, transactionCount: number): AccountDTO {
  return {
    id: row.id,
    name: row.name,
    type: row.type as AccountType,
    initialBalanceCents: row.initialBalanceCents,
    initialBalanceDate: row.initialBalanceDate,
    currency: row.currency,
    isLiquid: row.isLiquid,
    color: row.color,
    sortOrder: row.sortOrder,
    archived: row.archivedAt !== null,
    isDemo: row.isDemo,
    balanceCents,
    transactionCount,
  };
}

/**
 * All accounts of the user with their balance at the end of `asOf`:
 * initial (if its date ≤ asOf) + income − expenses − transfers out + transfers in.
 */
export async function listAccounts(userId: string, asOf: string): Promise<AccountDTO[]> {
  const db = getDb();
  const [rows, balances] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.userId, userId)).orderBy(accounts.sortOrder, accounts.createdAt),
    db.execute<BalanceRow>(sql`
      select a.id,
        (a.initial_balance_date <= ${asOf}::date) as initial_applies,
        coalesce(sum(t.amount_cents) filter (where t.type = 'income' and t.account_id = a.id and t.date <= ${asOf}::date), 0) as income,
        coalesce(sum(t.amount_cents) filter (where t.type = 'expense' and t.account_id = a.id and t.date <= ${asOf}::date), 0) as expense,
        coalesce(sum(t.amount_cents) filter (where t.type = 'transfer' and t.account_id = a.id and t.date <= ${asOf}::date), 0) as transfer_out,
        coalesce(sum(t.amount_cents) filter (where t.type = 'transfer' and t.to_account_id = a.id and t.date <= ${asOf}::date), 0) as transfer_in,
        count(t.id) as tx_count
      from accounts a
      left join transactions t
        on t.user_id = a.user_id and (t.account_id = a.id or t.to_account_id = a.id)
      where a.user_id = ${userId}
      group by a.id
    `),
  ]);
  const byId = new Map(balances.rows.map((b) => [b.id, b]));
  return rows.map((row) => {
    const b = byId.get(row.id);
    const balance = b
      ? accountBalance(b.initial_applies ? row.initialBalanceCents : 0, {
          incomeCents: Number(b.income),
          expenseCents: Number(b.expense),
          transferOutCents: Number(b.transfer_out),
          transferInCents: Number(b.transfer_in),
        })
      : 0;
    return toAccountDTO(row, balance, Number(b?.tx_count ?? 0));
  });
}

export async function getAccount(userId: string, id: string): Promise<AccountRow> {
  const [row] = await getDb()
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .limit(1);
  if (!row) throw notFound();
  return row;
}

export async function createAccount(
  userId: string,
  currency: string,
  input: z.output<typeof accountSchema>,
): Promise<AccountRow> {
  const db = getDb();
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${accounts.sortOrder}), 0)` })
    .from(accounts)
    .where(eq(accounts.userId, userId));
  const [row] = await db
    .insert(accounts)
    .values({
      userId,
      name: input.name,
      type: input.type,
      initialBalanceCents: input.initialBalanceCents,
      initialBalanceDate: input.initialBalanceDate,
      isLiquid: input.isLiquid,
      color: input.color ?? '#2a78d6',
      currency,
      sortOrder: Number(max) + 1,
    })
    .returning();
  return row;
}

export async function updateAccount(userId: string, id: string, input: z.output<typeof accountUpdateSchema>): Promise<AccountRow> {
  await getAccount(userId, id);
  const { archived, ...rest } = input;
  const [row] = await getDb()
    .update(accounts)
    .set({
      ...rest,
      ...(archived === undefined ? {} : { archivedAt: archived ? new Date() : null }),
      updatedAt: new Date(),
    })
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .returning();
  return row;
}

/** Deletes the account and (by cascade) every movement and recurring rule that uses it. */
export async function deleteAccount(userId: string, id: string): Promise<void> {
  await getAccount(userId, id);
  await getDb()
    .delete(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
}
