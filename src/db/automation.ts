/**
 * Work that a server would normally do on a schedule, done when the app opens instead:
 *  1. create the pending movements of every active recurring rule (up to today);
 *  2. create the interest of every finished month for savings accounts.
 *
 * Both are idempotent: they run inside one IndexedDB transaction (serialised across tabs), they
 * advance a marker (`lastGeneratedDate`, `interestProcessed`) together with the inserts, and the
 * generated rows have deterministic ids, so running them twice can never create duplicates.
 */
import { formatMonthYear, monthEnd, type ISODate } from '../lib/dates';
import { interestTransactionId, monthlyInterest, pendingInterestMonths } from '../lib/finance/interest';
import { pendingOccurrences, recurringTransactionId } from '../lib/finance/recurring';
import type { RecurringRule, Transaction } from '../lib/types';
import { T } from '../texts';
import { db as defaultDb, type FinancesDB } from './db';
import { CATEGORY_IDS, DEFAULT_CATEGORIES } from './seed';

export interface AutomationResult {
  recurringCreated: number;
  interestCreated: number;
}

/** Turns the pending occurrences of one rule into movements. Must run inside a rw transaction. */
export async function generateRule(database: FinancesDB, rule: RecurringRule, today: ISODate): Promise<number> {
  const dates = pendingOccurrences(rule, today);
  if (dates.length === 0) return 0;
  const now = Date.now();
  const ids = dates.map((d) => recurringTransactionId(rule.id, d));
  const existing = await database.transactions.bulkGet(ids);
  const rows: Transaction[] = [];
  dates.forEach((date, i) => {
    if (existing[i]) return;
    rows.push({
      id: ids[i],
      type: rule.type,
      date,
      amountCents: rule.amountCents,
      categoryId: rule.type === 'transfer' ? undefined : rule.categoryId,
      accountId: rule.accountId,
      toAccountId: rule.type === 'transfer' ? rule.toAccountId : undefined,
      description: rule.description,
      notes: rule.notes,
      source: 'recurring',
      recurringId: rule.id,
      createdAt: now,
      updatedAt: now,
    });
  });
  if (rows.length) await database.transactions.bulkAdd(rows);
  await database.recurringRules.update(rule.id, { lastGeneratedDate: dates[dates.length - 1] });
  return rows.length;
}

async function interestCategoryId(database: FinancesDB): Promise<string> {
  const existing = await database.categories.get(CATEGORY_IDS.interest);
  if (existing) return existing.id;
  const byName = (await database.categories.where('kind').equals('income').toArray()).find((c) => c.name === 'Interessos');
  if (byName) return byName.id;
  // The user deleted it: bring it back so interest always has a category.
  const seed = DEFAULT_CATEGORIES.find((c) => c.id === CATEGORY_IDS.interest)!;
  await database.categories.add({ ...seed, order: (await database.categories.count()) + 1, createdAt: Date.now() });
  return seed.id;
}

export async function runAutomation(today: ISODate, database: FinancesDB = defaultDb): Promise<AutomationResult> {
  return database.transaction('rw', [database.recurringRules, database.transactions, database.accounts, database.settings, database.categories], async () => {
    let recurringCreated = 0;
    for (const rule of await database.recurringRules.toArray()) {
      recurringCreated += await generateRule(database, rule, today);
    }

    let interestCreated = 0;
    const accounts = await database.accounts.toArray();
    const processedRow = await database.settings.get('interestProcessed');
    const processed = { ...((processedRow?.value as Record<string, string> | undefined) ?? {}) };
    let changed = false;

    for (const account of accounts) {
      const months = pendingInterestMonths(account, processed[account.id], today);
      if (months.length === 0) continue;
      const categoryId = await interestCategoryId(database);
      // Months are processed in order, so each month's interest counts in the next one's balance.
      const txs = await database.transactions.where('accountId').equals(account.id).toArray();
      const incoming = await database.transactions.where('toAccountId').equals(account.id).toArray();
      const all = [...txs, ...incoming];
      for (const month of months) {
        const { netCents } = monthlyInterest(account, all, month);
        const id = interestTransactionId(account.id, month);
        if (netCents > 0 && !(await database.transactions.get(id))) {
          const now = Date.now();
          const row: Transaction = {
            id,
            type: 'income',
            date: monthEnd(month),
            amountCents: netCents,
            categoryId,
            accountId: account.id,
            description: T.interest.description(formatMonthYear(month, false)),
            source: 'interest',
            createdAt: now,
            updatedAt: now,
          };
          await database.transactions.add(row);
          all.push(row);
          interestCreated++;
        }
        processed[account.id] = month;
        changed = true;
      }
    }
    if (changed) await database.settings.put({ key: 'interestProcessed', value: processed });
    return { recurringCreated, interestCreated };
  });
}
