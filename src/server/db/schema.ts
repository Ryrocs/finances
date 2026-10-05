import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/*
 * Conventions
 * - Money is stored as bigint integer cents (never floats).
 * - Calendar dates are `date` columns exchanged as 'YYYY-MM-DD' strings.
 * - Every financial row carries user_id. Composite foreign keys (x_id, user_id) make it
 *   impossible for a row to reference another user's account/category, even by mistake.
 */

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull().default(''),
    locale: text('locale').notNull().default('ca'),
    currency: text('currency').notNull().default('EUR'),
    timezone: text('timezone').notNull().default('Europe/Madrid'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('users_email_unique').on(t.email),
    check('users_locale_check', sql`${t.locale} in ('ca', 'es', 'en')`),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    // SHA-256 (hex) of the random session token. The raw token only exists in the cookie.
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId), index('sessions_expires_idx').on(t.expiresAt)],
);

export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull(),
    initialBalanceCents: bigint('initial_balance_cents', { mode: 'number' }).notNull().default(0),
    initialBalanceDate: date('initial_balance_date', { mode: 'string' }).notNull(),
    currency: text('currency').notNull().default('EUR'),
    isLiquid: boolean('is_liquid').notNull().default(true),
    color: text('color').notNull().default('#2563eb'),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('accounts_id_user_unique').on(t.id, t.userId),
    index('accounts_user_idx').on(t.userId),
    check('accounts_type_check', sql`${t.type} in ('checking', 'savings', 'cash', 'other')`),
  ],
);

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Built-in categories have a key (translated in the UI) and no custom name.
    key: text('key'),
    name: text('name'),
    kind: text('kind').notNull(),
    group: text('group').notNull(),
    icon: text('icon').notNull(),
    color: text('color').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('categories_id_user_unique').on(t.id, t.userId),
    unique('categories_user_key_unique').on(t.userId, t.key),
    index('categories_user_idx').on(t.userId),
    check('categories_kind_check', sql`${t.kind} in ('expense', 'income')`),
    check('categories_group_check', sql`${t.group} in ('needs', 'lifestyle', 'other', 'income')`),
    check('categories_label_check', sql`${t.key} is not null or ${t.name} is not null`),
  ],
);

export const recurringTransactions = pgTable(
  'recurring_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    accountId: uuid('account_id').notNull(),
    toAccountId: uuid('to_account_id'),
    categoryId: uuid('category_id'),
    description: text('description').notNull().default(''),
    notes: text('notes'),
    frequency: text('frequency').notNull(),
    interval: integer('interval').notNull().default(1),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }),
    lastGeneratedDate: date('last_generated_date', { mode: 'string' }),
    isActive: boolean('is_active').notNull().default(true),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('recurring_id_user_unique').on(t.id, t.userId),
    index('recurring_user_idx').on(t.userId),
    foreignKey({ columns: [t.accountId, t.userId], foreignColumns: [accounts.id, accounts.userId] }).onDelete('cascade'),
    foreignKey({ columns: [t.toAccountId, t.userId], foreignColumns: [accounts.id, accounts.userId] }).onDelete('cascade'),
    foreignKey({ columns: [t.categoryId, t.userId], foreignColumns: [categories.id, categories.userId] }),
    check('recurring_type_check', sql`${t.type} in ('expense', 'income', 'transfer')`),
    check('recurring_amount_check', sql`${t.amountCents} > 0`),
    check('recurring_frequency_check', sql`${t.frequency} in ('weekly', 'monthly', 'yearly')`),
    check('recurring_interval_check', sql`${t.interval} between 1 and 12`),
    check('recurring_dates_check', sql`${t.endDate} is null or ${t.endDate} >= ${t.startDate}`),
    check(
      'recurring_shape_check',
      sql`(${t.type} = 'transfer' and ${t.toAccountId} is not null and ${t.toAccountId} <> ${t.accountId} and ${t.categoryId} is null)
        or (${t.type} in ('expense', 'income') and ${t.toAccountId} is null and ${t.categoryId} is not null)`,
    ),
  ],
);

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    accountId: uuid('account_id').notNull(),
    toAccountId: uuid('to_account_id'),
    categoryId: uuid('category_id'),
    description: text('description').notNull().default(''),
    notes: text('notes'),
    recurringId: uuid('recurring_id').references(() => recurringTransactions.id, { onDelete: 'set null' }),
    occurrenceDate: date('occurrence_date', { mode: 'string' }),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('transactions_user_date_idx').on(t.userId, t.date),
    index('transactions_account_idx').on(t.accountId),
    index('transactions_to_account_idx').on(t.toAccountId),
    index('transactions_category_idx').on(t.categoryId),
    // A recurring rule can never produce the same scheduled occurrence twice.
    unique('transactions_recurring_occurrence_unique').on(t.recurringId, t.occurrenceDate),
    foreignKey({ columns: [t.accountId, t.userId], foreignColumns: [accounts.id, accounts.userId] }).onDelete('cascade'),
    foreignKey({ columns: [t.toAccountId, t.userId], foreignColumns: [accounts.id, accounts.userId] }).onDelete('cascade'),
    foreignKey({ columns: [t.categoryId, t.userId], foreignColumns: [categories.id, categories.userId] }),
    check('transactions_type_check', sql`${t.type} in ('expense', 'income', 'transfer')`),
    check('transactions_amount_check', sql`${t.amountCents} > 0`),
    check(
      'transactions_shape_check',
      sql`(${t.type} = 'transfer' and ${t.toAccountId} is not null and ${t.toAccountId} <> ${t.accountId} and ${t.categoryId} is null)
        or (${t.type} in ('expense', 'income') and ${t.toAccountId} is null and ${t.categoryId} is not null)`,
    ),
  ],
);

export const budgets = pgTable(
  'budgets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // NULL = overall monthly budget.
    categoryId: uuid('category_id'),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('budgets_user_category_unique').on(t.userId, t.categoryId).nullsNotDistinct(),
    foreignKey({ columns: [t.categoryId, t.userId], foreignColumns: [categories.id, categories.userId] }).onDelete('cascade'),
    check('budgets_amount_check', sql`${t.amountCents} > 0`),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type AccountRow = typeof accounts.$inferSelect;
export type CategoryRow = typeof categories.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;
export type RecurringRow = typeof recurringTransactions.$inferSelect;
export type BudgetRow = typeof budgets.$inferSelect;
