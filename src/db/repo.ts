/**
 * Every write to the database goes through here. Writes that touch several tables run in a single
 * IndexedDB transaction, so a failure never leaves half-applied changes (e.g. orphan movements).
 */
import { buildBackup, type BackupData, type BackupFile } from '../lib/backup';
import { type ISODate, type MonthKey } from '../lib/dates';
import { resumeFrom } from '../lib/finance/recurring';
import type { Account, AccountType, Budget, Category, CategoryGroup, CategoryKind, Frequency, RecurringRule, SettingKey, SettingsMap, TransactionType } from '../lib/types';
import { hasErrors, validateMovement } from '../lib/validation';
import { generateRule } from './automation';
import { db as defaultDb, newId, type FinancesDB } from './db';
import { CATEGORY_IDS, defaultCategories } from './seed';

let database: FinancesDB = defaultDb;

/** Tests point the repository at their own database. */
export function setDatabase(next: FinancesDB) {
  database = next;
}

// ——— Settings ———

export async function getSettings(): Promise<Partial<SettingsMap>> {
  const rows = await database.settings.toArray();
  return Object.fromEntries(rows.map((r) => [r.key, r.value])) as Partial<SettingsMap>;
}

export async function setSetting<K extends SettingKey>(key: K, value: SettingsMap[K]) {
  await database.settings.put({ key, value });
}

/** Creates the initial categories the first time (and after wiping everything). */
export async function ensureSeed() {
  await database.transaction('rw', database.categories, async () => {
    if ((await database.categories.count()) === 0) await database.categories.bulkAdd(defaultCategories());
  });
}

// ——— Accounts ———

export interface AccountData {
  name: string;
  type: AccountType;
  color: string;
  initialBalanceCents: number;
  initialBalanceDate: ISODate;
  tae?: number;
  withholdingPct?: number;
}

function cleanAccount(data: AccountData): AccountData {
  const isSavings = data.type === 'remunerat';
  return {
    name: data.name.trim(),
    type: data.type,
    color: data.color,
    initialBalanceCents: data.initialBalanceCents,
    initialBalanceDate: data.initialBalanceDate,
    tae: isSavings ? (data.tae ?? 0) : undefined,
    withholdingPct: isSavings ? (data.withholdingPct ?? 19) : undefined,
  };
}

export async function createAccounts(list: AccountData[]): Promise<string[]> {
  return database.transaction('rw', database.accounts, async () => {
    const order = await database.accounts.count();
    const now = Date.now();
    const rows: Account[] = list.map((data, i) => ({ id: newId(), ...cleanAccount(data), order: order + i, createdAt: now }));
    await database.accounts.bulkAdd(rows);
    return rows.map((r) => r.id);
  });
}

export async function createAccount(data: AccountData): Promise<string> {
  return (await createAccounts([data]))[0];
}

export async function updateAccount(id: string, data: AccountData) {
  // Dexie removes the properties set to undefined (e.g. the TAE of an account that is no longer 'remunerat').
  await database.accounts.update(id, { ...cleanAccount(data) });
}

/** Deletes the account, all its movements (transfers with other accounts too) and its rules. */
export async function deleteAccount(id: string) {
  await database.transaction('rw', [database.accounts, database.transactions, database.recurringRules, database.settings], async () => {
    await database.transactions.where('accountId').equals(id).delete();
    await database.transactions.where('toAccountId').equals(id).delete();
    await database.recurringRules.filter((r) => r.accountId === id || r.toAccountId === id).delete();
    await database.accounts.delete(id);
    const processed = await database.settings.get('interestProcessed');
    if (processed) {
      const value = { ...(processed.value as Record<string, string>) };
      delete value[id];
      await database.settings.put({ key: 'interestProcessed', value });
    }
    const last = await database.settings.get('lastAccountId');
    if (last?.value === id) await database.settings.delete('lastAccountId');
  });
}

// ——— Categories ———

export interface CategoryData {
  name: string;
  emoji: string;
  color: string;
  kind: CategoryKind;
  group?: CategoryGroup;
}

export async function createCategory(data: CategoryData): Promise<string> {
  const id = newId();
  const order = await database.categories.count();
  await database.categories.add({
    id,
    name: data.name.trim(),
    emoji: data.emoji.trim(),
    color: data.color,
    kind: data.kind,
    group: data.kind === 'expense' ? (data.group ?? 'altres') : undefined,
    order,
    createdAt: Date.now(),
  });
  return id;
}

export async function updateCategory(id: string, data: Pick<CategoryData, 'name' | 'emoji' | 'color' | 'group'>) {
  const current = await database.categories.get(id);
  if (!current) return;
  await database.categories.update(id, {
    name: data.name.trim(),
    emoji: data.emoji.trim(),
    color: data.color,
    group: current.kind === 'expense' ? (data.group ?? current.group ?? 'altres') : undefined,
  });
}

export async function categoryUsage(id: string): Promise<{ movements: number; rules: number }> {
  const movements = await database.transactions.where('categoryId').equals(id).count();
  const rules = await database.recurringRules.filter((r) => r.categoryId === id).count();
  return { movements, rules };
}

/** Default target when a category is deleted: "Altres" / "Altres ingressos", else the first one of the same kind. */
export function defaultReassignTarget(categories: readonly Category[], deleted: Category): Category | undefined {
  const candidates = categories.filter((c) => c.kind === deleted.kind && c.id !== deleted.id);
  const preferred = deleted.kind === 'expense' ? CATEGORY_IDS.otherExpense : CATEGORY_IDS.otherIncome;
  return candidates.find((c) => c.id === preferred) ?? candidates[0];
}

/** Deletes a category moving its movements and rules to `reassignTo`: never leaves orphans. */
export async function deleteCategory(id: string, reassignTo: string) {
  await database.transaction('rw', [database.categories, database.transactions, database.recurringRules, database.budgets], async () => {
    const deleted = await database.categories.get(id);
    const target = await database.categories.get(reassignTo);
    if (!deleted) return;
    if (!target || target.kind !== deleted.kind || target.id === deleted.id) throw new Error('Invalid reassignment target');
    const now = Date.now();
    await database.transactions.where('categoryId').equals(id).modify({ categoryId: reassignTo, updatedAt: now });
    await database.recurringRules.filter((r) => r.categoryId === id).modify({ categoryId: reassignTo });
    await database.budgets.toCollection().modify((b) => {
      delete b.perCategory[id];
    });
    await database.categories.delete(id);
  });
}

// ——— Movements ———

export interface MovementData {
  type: TransactionType;
  date: ISODate;
  amountCents: number;
  categoryId?: string;
  accountId: string;
  toAccountId?: string;
  description?: string;
  notes?: string;
}

function cleanText(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

function cleanMovement(data: MovementData): MovementData {
  const isTransfer = data.type === 'transfer';
  return {
    type: data.type,
    date: data.date,
    amountCents: data.amountCents,
    categoryId: isTransfer ? undefined : data.categoryId,
    accountId: data.accountId,
    toAccountId: isTransfer ? data.toAccountId : undefined,
    description: cleanText(data.description),
    notes: cleanText(data.notes),
  };
}

async function assertValid(data: MovementData) {
  const [accounts, categories] = await Promise.all([database.accounts.toArray(), database.categories.toArray()]);
  const errors = validateMovement(data, accounts, categories);
  if (hasErrors(errors)) throw new Error(Object.values(errors).join(' '));
}

/** Creates (no id) or updates a movement. Returns its id. */
export async function saveMovement(data: MovementData, id?: string): Promise<string> {
  const clean = cleanMovement(data);
  return database.transaction('rw', [database.transactions, database.accounts, database.categories, database.settings], async () => {
    await assertValid(clean);
    const now = Date.now();
    if (id) {
      const existing = await database.transactions.get(id);
      if (!existing) throw new Error('Movement not found');
      // Optional fields set to undefined are removed by put().
      await database.transactions.put({ ...existing, ...clean, id, updatedAt: now });
    } else {
      id = newId();
      await database.transactions.add({ ...clean, id, source: 'manual', createdAt: now, updatedAt: now });
    }
    await database.settings.put({ key: 'lastAccountId', value: clean.accountId });
    return id;
  });
}

export async function deleteMovement(id: string) {
  await database.transactions.delete(id);
}

// ——— Recurring rules ———

export interface RuleData extends MovementData {
  frequency: Frequency;
  dayOfMonth?: number;
  weekday?: number;
  /** Equals `date`: the first day the rule can produce a movement. */
  startDate: ISODate;
  endDate?: ISODate;
}

function cleanRule(data: RuleData) {
  const m = cleanMovement(data);
  return {
    type: m.type,
    amountCents: m.amountCents,
    categoryId: m.categoryId,
    accountId: m.accountId,
    toAccountId: m.toAccountId,
    description: m.description,
    notes: m.notes,
    frequency: data.frequency,
    dayOfMonth: data.frequency === 'weekly' ? undefined : data.dayOfMonth,
    weekday: data.frequency === 'weekly' ? data.weekday : undefined,
    startDate: data.startDate,
    endDate: data.endDate || undefined,
  };
}

/** Creates the rule and, at once, the movements due from its start date up to today. */
export async function createRule(data: RuleData, today: ISODate): Promise<{ id: string; generated: number }> {
  const rule: RecurringRule = { id: newId(), ...cleanRule(data), active: true, createdAt: Date.now() };
  return database.transaction('rw', [database.recurringRules, database.transactions, database.accounts, database.categories, database.settings], async () => {
    await assertValid({ ...data, date: rule.startDate });
    await database.recurringRules.add(rule);
    const generated = await generateRule(database, rule, today);
    await database.settings.put({ key: 'lastAccountId', value: rule.accountId });
    return { id: rule.id, generated };
  });
}

/** Updates a rule. Movements already generated stay as they are; future ones follow the new values. */
export async function updateRule(id: string, data: RuleData, today: ISODate) {
  await database.transaction('rw', [database.recurringRules, database.transactions, database.accounts, database.categories], async () => {
    const existing = await database.recurringRules.get(id);
    if (!existing) throw new Error('Rule not found');
    await assertValid({ ...data, date: data.startDate });
    const updated: RecurringRule = { ...existing, ...cleanRule(data) };
    await database.recurringRules.put(updated);
    await generateRule(database, updated, today);
  });
}

export async function setRuleActive(id: string, active: boolean, today: ISODate) {
  await database.transaction('rw', [database.recurringRules, database.transactions], async () => {
    const rule = await database.recurringRules.get(id);
    if (!rule) return;
    if (!active) {
      await database.recurringRules.update(id, { active: false });
      return;
    }
    const resumed: RecurringRule = { ...rule, active: true, lastGeneratedDate: resumeFrom(rule, today) };
    await database.recurringRules.put(resumed);
    await generateRule(database, resumed, today);
  });
}

/** Deletes the rule only: the movements it generated stay. */
export async function deleteRule(id: string) {
  await database.recurringRules.delete(id);
}

// ——— Budgets ———

export async function saveBudget(month: Budget['month'], totalCents: number | undefined, perCategory: Record<string, number>) {
  await database.transaction('rw', database.budgets, async () => {
    const existing = await database.budgets.where('month').equals(month).first();
    const clean = Object.fromEntries(Object.entries(perCategory).filter(([, v]) => Number.isInteger(v) && v > 0));
    const row: Budget = { id: existing?.id ?? newId(), month, totalCents: totalCents && totalCents > 0 ? totalCents : undefined, perCategory: clean };
    await database.budgets.put(row);
  });
}

/** "Customize only this month": starts from a copy of the default budget. */
export async function customizeMonth(month: MonthKey) {
  await database.transaction('rw', database.budgets, async () => {
    if (await database.budgets.where('month').equals(month).first()) return;
    const fallback = await database.budgets.where('month').equals('default').first();
    await database.budgets.add({ id: newId(), month, totalCents: fallback?.totalCents, perCategory: { ...(fallback?.perCategory ?? {}) } });
  });
}

export async function resetMonthToDefault(month: MonthKey) {
  await database.budgets.where('month').equals(month).delete();
}

// ——— Backups ———

export async function readAllData(): Promise<BackupData> {
  const [accounts, categories, transactions, recurringRules, budgets, settings] = await Promise.all([
    database.accounts.toArray(),
    database.categories.toArray(),
    database.transactions.toArray(),
    database.recurringRules.toArray(),
    database.budgets.toArray(),
    database.settings.toArray(),
  ]);
  return { accounts, categories, transactions, recurringRules, budgets, settings };
}

/** Builds the backup file. Call `markBackupDone` once the user has actually saved it. */
export async function exportBackup(now = new Date()): Promise<BackupFile> {
  return buildBackup(await readAllData(), now);
}

export async function markBackupDone(now = new Date()) {
  await setSetting('lastBackupAt', now.getTime());
}

/** Replaces every table with the content of a validated backup, atomically. */
export async function restoreBackup(backup: BackupFile) {
  const d = backup.data;
  await database.transaction('rw', [database.accounts, database.categories, database.transactions, database.recurringRules, database.budgets, database.settings], async () => {
    await Promise.all([
      database.accounts.clear(),
      database.categories.clear(),
      database.transactions.clear(),
      database.recurringRules.clear(),
      database.budgets.clear(),
      database.settings.clear(),
    ]);
    await database.accounts.bulkAdd(d.accounts);
    await database.categories.bulkAdd(d.categories);
    await database.transactions.bulkAdd(d.transactions);
    await database.recurringRules.bulkAdd(d.recurringRules);
    await database.budgets.bulkAdd(d.budgets);
    await database.settings.bulkPut(d.settings);
    await database.settings.put({ key: 'onboardingDone', value: true });
  });
}

// ——— Everything ———

export async function wipeAll() {
  await database.transaction('rw', [database.accounts, database.categories, database.transactions, database.recurringRules, database.budgets, database.settings], async () => {
    await Promise.all([
      database.accounts.clear(),
      database.categories.clear(),
      database.transactions.clear(),
      database.recurringRules.clear(),
      database.budgets.clear(),
      database.settings.clear(),
    ]);
  });
  await ensureSeed();
}

export function currentDatabase(): FinancesDB {
  return database;
}
