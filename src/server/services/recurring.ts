import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { monthEnd, monthOf, todayInTimeZone } from '@/lib/dates';
import { nextOccurrence, occurrencesBetween, type Schedule } from '@/lib/finance/recurring';
import type { Frequency, RecurringDTO, TransactionType } from '@/lib/types';
import type { RecurringInput } from '@/lib/validation';
import { getDb } from '../db';
import { recurringTransactions, transactions, users, type RecurringRow } from '../db/schema';
import { notFound } from '../http';
import { assertReferences } from './transactions';

function scheduleOf(row: Pick<RecurringRow, 'frequency' | 'interval' | 'startDate' | 'endDate'>): Schedule {
  return { frequency: row.frequency as Frequency, interval: row.interval, startDate: row.startDate, endDate: row.endDate };
}

function toRecurringDTO(row: RecurringRow): RecurringDTO {
  return {
    id: row.id,
    type: row.type as TransactionType,
    amountCents: row.amountCents,
    accountId: row.accountId,
    toAccountId: row.toAccountId,
    categoryId: row.categoryId,
    description: row.description,
    notes: row.notes,
    frequency: row.frequency as Frequency,
    interval: row.interval,
    startDate: row.startDate,
    endDate: row.endDate,
    isActive: row.isActive,
    isDemo: row.isDemo,
    lastGeneratedDate: row.lastGeneratedDate,
    nextDate: row.isActive ? nextOccurrence(scheduleOf(row), row.lastGeneratedDate) : null,
  };
}

export async function listRecurring(userId: string): Promise<RecurringDTO[]> {
  const rows = await getDb()
    .select()
    .from(recurringTransactions)
    .where(eq(recurringTransactions.userId, userId))
    .orderBy(recurringTransactions.createdAt);
  return rows.map(toRecurringDTO);
}

async function getRecurring(userId: string, id: string): Promise<RecurringRow> {
  const [row] = await getDb()
    .select()
    .from(recurringTransactions)
    .where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.userId, userId)))
    .limit(1);
  if (!row) throw notFound();
  return row;
}

function valuesFrom(input: RecurringInput) {
  return {
    type: input.type,
    amountCents: input.amountCents,
    accountId: input.accountId,
    toAccountId: input.type === 'transfer' ? input.toAccountId : null,
    categoryId: input.type === 'transfer' ? null : input.categoryId,
    description: input.description,
    notes: input.notes,
    frequency: input.frequency,
    interval: input.interval,
    startDate: input.startDate,
    endDate: input.endDate,
    isActive: input.isActive,
  };
}

async function checkRefs(userId: string, input: RecurringInput) {
  await assertReferences(userId, {
    type: input.type,
    accountId: input.accountId,
    toAccountId: input.type === 'transfer' ? input.toAccountId : null,
    categoryId: input.type === 'transfer' ? null : input.categoryId,
  });
}

export async function createRecurring(userId: string, input: RecurringInput, today: string): Promise<RecurringDTO> {
  await checkRefs(userId, input);
  const [row] = await getDb()
    .insert(recurringTransactions)
    .values({ userId, ...valuesFrom(input) })
    .returning();
  await generateDueForUser(userId, today);
  return toRecurringDTO(await getRecurring(userId, row.id));
}

/**
 * Schedule changes apply to future occurrences only: already generated movements are kept
 * and `last_generated_date` is preserved, so nothing is generated twice.
 */
export async function updateRecurring(userId: string, id: string, input: RecurringInput, today: string): Promise<RecurringDTO> {
  await getRecurring(userId, id);
  await checkRefs(userId, input);
  await getDb()
    .update(recurringTransactions)
    .set({ ...valuesFrom(input), updatedAt: new Date() })
    .where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.userId, userId)));
  await generateDueForUser(userId, today);
  return toRecurringDTO(await getRecurring(userId, id));
}

/** Deleting a rule stops future occurrences; movements already generated stay. */
export async function deleteRecurring(userId: string, id: string): Promise<void> {
  await getRecurring(userId, id);
  await getDb()
    .delete(recurringTransactions)
    .where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.userId, userId)));
}

/**
 * Materialises every due occurrence (≤ today) of the user's active rules.
 * Idempotent and safe under concurrency:
 *  - rules are locked FOR UPDATE inside a transaction (concurrent runs serialise),
 *  - inserts use ON CONFLICT DO NOTHING on UNIQUE (recurring_id, occurrence_date).
 * Returns the number of movements created.
 */
export async function generateDueForUser(userId: string, today: string): Promise<number> {
  return getDb().transaction(async (tx) => {
    const rules = await tx
      .select()
      .from(recurringTransactions)
      .where(
        and(
          eq(recurringTransactions.userId, userId),
          eq(recurringTransactions.isActive, true),
          sql`${recurringTransactions.startDate} <= ${today}::date`,
          sql`(${recurringTransactions.lastGeneratedDate} is null or ${recurringTransactions.lastGeneratedDate} < ${today}::date)`,
        ),
      )
      .for('update');

    let created = 0;
    for (const rule of rules) {
      const dates = occurrencesBetween(scheduleOf(rule), rule.lastGeneratedDate, today);
      if (!dates.length) continue;
      const inserted = await tx
        .insert(transactions)
        .values(
          dates.map((date) => ({
            userId,
            type: rule.type,
            amountCents: rule.amountCents,
            date,
            accountId: rule.accountId,
            toAccountId: rule.toAccountId,
            categoryId: rule.categoryId,
            description: rule.description,
            notes: rule.notes,
            recurringId: rule.id,
            occurrenceDate: date,
            isDemo: rule.isDemo,
          })),
        )
        .onConflictDoNothing({ target: [transactions.recurringId, transactions.occurrenceDate] })
        .returning({ id: transactions.id });
      created += inserted.length;
      await tx
        .update(recurringTransactions)
        .set({ lastGeneratedDate: dates[dates.length - 1] })
        .where(eq(recurringTransactions.id, rule.id));
    }
    return created;
  });
}

/** Cron entry point: generate for every user with due rules, using each user's local date. */
export async function generateDueForAllUsers(now = new Date()): Promise<{ users: number; created: number }> {
  const rows = await getDb()
    .selectDistinct({ userId: recurringTransactions.userId, timezone: users.timezone })
    .from(recurringTransactions)
    .innerJoin(users, eq(users.id, recurringTransactions.userId))
    .where(eq(recurringTransactions.isActive, true));
  let created = 0;
  for (const r of rows) created += await generateDueForUser(r.userId, todayInTimeZone(r.timezone, now));
  return { users: rows.length, created };
}

/** Recurring expenses still scheduled after `today` within today's month (for the projection). */
export async function pendingRecurringExpenses(userId: string, today: string): Promise<number> {
  const rows = await getDb()
    .select()
    .from(recurringTransactions)
    .where(and(eq(recurringTransactions.userId, userId), eq(recurringTransactions.isActive, true), eq(recurringTransactions.type, 'expense')));
  const end = monthEnd(monthOf(today));
  let total = 0;
  for (const rule of rows) {
    const after = rule.lastGeneratedDate && rule.lastGeneratedDate > today ? rule.lastGeneratedDate : today;
    total += occurrencesBetween(scheduleOf(rule), after, end).length * rule.amountCents;
  }
  return total;
}
