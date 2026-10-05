import 'server-only';
import { asc, eq } from 'drizzle-orm';
import { loadMessages } from '@/lib/i18n/load';
import { createTranslator } from '@/lib/i18n/translate';
import type { Locale } from '@/lib/types';
import { getDb } from '../db';
import { accounts, budgets, categories, recurringTransactions, transactions } from '../db/schema';

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s) && typeof value === 'string') s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Cents → "1234.56" (dot decimal, no grouping) — unambiguous for spreadsheets and scripts. */
function plainAmount(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export async function exportCsv(userId: string, locale: Locale): Promise<string> {
  const db = getDb();
  const { t, tDynamic } = createTranslator(locale, await loadMessages(locale));
  const [txs, accs, cats] = await Promise.all([
    db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(asc(transactions.date), asc(transactions.createdAt)),
    db.select().from(accounts).where(eq(accounts.userId, userId)),
    db.select().from(categories).where(eq(categories.userId, userId)),
  ]);
  const accName = new Map(accs.map((a) => [a.id, a.name]));
  const catName = new Map(cats.map((c) => [c.id, c.name ?? (c.key ? tDynamic(`categories.${c.key}`, c.key) : '')]));
  const header = [t('form.date'), t('movements.type'), t('form.amount'), t('form.account'), t('form.toAccount'), t('form.category'), t('form.description'), t('form.notes'), t('common.demo')];
  const lines = [header.map(csvCell).join(',')];
  for (const tx of txs) {
    lines.push(
      [
        tx.date,
        t(`types.${tx.type as 'expense' | 'income' | 'transfer'}`),
        plainAmount(tx.type === 'expense' ? -tx.amountCents : tx.amountCents),
        accName.get(tx.accountId) ?? '',
        tx.toAccountId ? (accName.get(tx.toAccountId) ?? '') : '',
        tx.categoryId ? (catName.get(tx.categoryId) ?? '') : '',
        tx.description,
        tx.notes ?? '',
        tx.isDemo ? t('common.yes') : '',
      ]
        .map(csvCell)
        .join(','),
    );
  }
  // BOM so Excel opens UTF-8 (accents) correctly.
  return `﻿${lines.join('\r\n')}\r\n`;
}

export async function exportJson(userId: string) {
  const db = getDb();
  const [accs, cats, txs, buds, recs] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.userId, userId)),
    db.select().from(categories).where(eq(categories.userId, userId)),
    db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(asc(transactions.date)),
    db.select().from(budgets).where(eq(budgets.userId, userId)),
    db.select().from(recurringTransactions).where(eq(recurringTransactions.userId, userId)),
  ]);
  const strip = <T extends { userId: string }>(rows: T[]) => rows.map(({ userId: _u, ...rest }) => (void _u, rest));
  return {
    format: 'finances-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    note: 'All amounts are integer cents.',
    accounts: strip(accs),
    categories: strip(cats),
    transactions: strip(txs),
    budgets: strip(buds),
    recurring: strip(recs),
  };
}
