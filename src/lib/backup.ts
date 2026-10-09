/**
 * JSON backup format. A backup holds every table, so restoring it reproduces the app exactly.
 * Bump BACKUP_SCHEMA_VERSION when the row format changes, and teach `validateBackup` to upgrade
 * older files.
 */
import { isValidISODate, isValidMonthKey } from './dates';
import type { Account, Budget, Category, RecurringRule, SettingRow, Transaction } from './types';

export const BACKUP_APP = 'finances';
export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupData {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurringRules: RecurringRule[];
  budgets: Budget[];
  settings: SettingRow[];
}

export interface BackupFile {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  exportedAt: string;
  data: BackupData;
}

export function buildBackup(data: BackupData, now = new Date()): BackupFile {
  return { app: BACKUP_APP, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: now.toISOString(), data };
}

type Result = { ok: true; backup: BackupFile } | { ok: false; reason: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isOptStr = (v: unknown) => v === undefined || v === null || typeof v === 'string';
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const ACCOUNT_TYPES = ['corrent', 'remunerat', 'efectiu', 'altre'];
const TX_TYPES = ['expense', 'income', 'transfer'];
const SOURCES = ['manual', 'recurring', 'interest'];
const FREQUENCIES = ['weekly', 'monthly', 'yearly'];

function checkAccount(a: unknown): string | null {
  if (!isObj(a)) return 'compte';
  if (!isStr(a.id) || !isStr(a.name) || !ACCOUNT_TYPES.includes(a.type as string)) return 'compte';
  if (!isInt(a.initialBalanceCents) || !isValidISODate(a.initialBalanceDate)) return `compte ${a.name}`;
  if (a.tae !== undefined && a.tae !== null && !isNum(a.tae)) return `compte ${a.name}`;
  if (a.withholdingPct !== undefined && a.withholdingPct !== null && !isNum(a.withholdingPct)) return `compte ${a.name}`;
  return null;
}

function checkCategory(c: unknown): string | null {
  if (!isObj(c) || !isStr(c.id) || !isStr(c.name) || typeof c.emoji !== 'string' || (c.kind !== 'expense' && c.kind !== 'income')) return 'categoria';
  return null;
}

function checkTransaction(t: unknown, accounts: Set<string>, categories: Map<string, string>): string | null {
  if (!isObj(t) || !isStr(t.id)) return 'moviment';
  const where = `moviment del ${String(t.date)}`;
  if (!TX_TYPES.includes(t.type as string) || !isValidISODate(t.date) || !isInt(t.amountCents) || (t.amountCents as number) <= 0) return where;
  if (!isStr(t.accountId) || !accounts.has(t.accountId)) return where;
  if (t.type === 'transfer') {
    if (!isStr(t.toAccountId) || !accounts.has(t.toAccountId) || t.toAccountId === t.accountId) return where;
  } else if (!isStr(t.categoryId) || categories.get(t.categoryId) !== t.type) return where;
  if (t.source !== undefined && !SOURCES.includes(t.source as string)) return where;
  if (!isOptStr(t.description) || !isOptStr(t.notes)) return where;
  return null;
}

function checkRule(r: unknown, accounts: Set<string>, categories: Map<string, string>): string | null {
  if (!isObj(r) || !isStr(r.id)) return 'regla recurrent';
  if (!TX_TYPES.includes(r.type as string) || !FREQUENCIES.includes(r.frequency as string)) return 'regla recurrent';
  if (!isInt(r.amountCents) || (r.amountCents as number) <= 0 || !isValidISODate(r.startDate)) return 'regla recurrent';
  if (r.endDate !== undefined && r.endDate !== null && !isValidISODate(r.endDate)) return 'regla recurrent';
  if (r.lastGeneratedDate !== undefined && r.lastGeneratedDate !== null && !isValidISODate(r.lastGeneratedDate)) return 'regla recurrent';
  if (!isStr(r.accountId) || !accounts.has(r.accountId)) return 'regla recurrent';
  if (r.type === 'transfer' ? !isStr(r.toAccountId) || !accounts.has(r.toAccountId) : !isStr(r.categoryId) || !categories.has(r.categoryId)) return 'regla recurrent';
  return null;
}

function checkBudget(b: unknown): string | null {
  if (!isObj(b) || !isStr(b.id) || !(b.month === 'default' || isValidMonthKey(b.month)) || !isObj(b.perCategory)) return 'pressupost';
  if (b.totalCents !== undefined && b.totalCents !== null && !isInt(b.totalCents)) return 'pressupost';
  if (!Object.values(b.perCategory).every(isInt)) return 'pressupost';
  return null;
}

/** Validates a parsed JSON file. Returns a normalised backup or the first problem found. */
export function validateBackup(json: unknown): Result {
  if (!isObj(json) || json.app !== BACKUP_APP || !isInt(json.schemaVersion)) return { ok: false, reason: 'format' };
  if (json.schemaVersion > BACKUP_SCHEMA_VERSION) return { ok: false, reason: 'versió més nova' };
  const d = json.data;
  if (!isObj(d)) return { ok: false, reason: 'format' };
  for (const key of ['accounts', 'categories', 'transactions', 'recurringRules', 'budgets', 'settings'] as const) {
    if (!Array.isArray(d[key])) return { ok: false, reason: key };
  }
  const data = d as unknown as BackupData;
  if (data.accounts.length === 0) return { ok: false, reason: 'sense comptes' };

  for (const a of data.accounts) {
    const err = checkAccount(a);
    if (err) return { ok: false, reason: err };
  }
  for (const c of data.categories) {
    const err = checkCategory(c);
    if (err) return { ok: false, reason: err };
  }
  const accountIds = new Set(data.accounts.map((a) => a.id));
  const categoryKinds = new Map(data.categories.map((c) => [c.id, c.kind as string]));
  if (accountIds.size !== data.accounts.length || categoryKinds.size !== data.categories.length) return { ok: false, reason: 'ids duplicats' };

  const txIds = new Set<string>();
  for (const t of data.transactions) {
    const err = checkTransaction(t, accountIds, categoryKinds);
    if (err) return { ok: false, reason: err };
    if (txIds.has(t.id)) return { ok: false, reason: 'ids duplicats' };
    txIds.add(t.id);
  }
  for (const r of data.recurringRules) {
    const err = checkRule(r, accountIds, categoryKinds);
    if (err) return { ok: false, reason: err };
  }
  const months = new Set<string>();
  for (const b of data.budgets) {
    const err = checkBudget(b);
    if (err) return { ok: false, reason: err };
    if (months.has(b.month)) return { ok: false, reason: 'pressupost duplicat' };
    months.add(b.month);
  }
  for (const s of data.settings) {
    if (!isObj(s) || !isStr(s.key)) return { ok: false, reason: 'configuració' };
  }

  return { ok: true, backup: json as unknown as BackupFile };
}
