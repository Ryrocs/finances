/**
 * IndexedDB database (Dexie). All data lives only on this device.
 *
 * SCHEMA MIGRATIONS — read before changing anything here:
 * - Never edit or delete an existing `version(n)` block: browsers that already have the data
 *   upgrade from it.
 * - To change the schema, add `this.version(n + 1).stores({...}).upgrade(tx => ...)` with the new
 *   indexes and a migration that transforms existing rows. Dexie keeps the data of tables that are
 *   not mentioned. Bump BACKUP_SCHEMA_VERSION in src/lib/backup.ts if the row format changes.
 * - Never delete a table that holds user data without migrating it first.
 */
import Dexie, { type Table } from 'dexie';
import type { Account, Budget, Category, RecurringRule, SettingRow, Transaction } from '../lib/types';

export const DB_NAME = 'finances';

export class FinancesDB extends Dexie {
  accounts!: Table<Account, string>;
  categories!: Table<Category, string>;
  transactions!: Table<Transaction, string>;
  recurringRules!: Table<RecurringRule, string>;
  budgets!: Table<Budget, string>;
  settings!: Table<SettingRow, string>;

  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores({
      accounts: 'id, order',
      categories: 'id, kind, order',
      transactions: 'id, date, type, accountId, toAccountId, categoryId, recurringId',
      recurringRules: 'id',
      budgets: 'id, &month',
      settings: 'key',
    });
  }
}

export const db = new FinancesDB();

export const ALL_TABLES = ['accounts', 'categories', 'transactions', 'recurringRules', 'budgets', 'settings'] as const;
export type TableName = (typeof ALL_TABLES)[number];

export function tables(database: FinancesDB = db) {
  return ALL_TABLES.map((name) => database[name]);
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}
