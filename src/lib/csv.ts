/**
 * CSV export for Excel/Numbers in Catalan or Spanish: ';' separator, decimal comma and UTF-8 with
 * a BOM (without it Excel reads the accents wrong).
 */
import { T } from '../texts';
import type { Account, Category, Transaction } from './types';

export const BOM = '\uFEFF';

function cell(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** 183157 → "1831,57" (no thousands separator, so spreadsheets read it as a number). */
export function csvAmount(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.trunc(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

export function buildCsv(txs: readonly Transaction[], accounts: readonly Account[], categories: readonly Category[]): string {
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const sorted = [...txs].sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));
  const lines = [T.csv.header.join(';')];
  for (const tx of sorted) {
    lines.push(
      [
        tx.date,
        T.types[tx.type],
        csvAmount(tx.amountCents),
        tx.categoryId ? (categoryName.get(tx.categoryId) ?? '') : '',
        accountName.get(tx.accountId) ?? '',
        tx.toAccountId ? (accountName.get(tx.toAccountId) ?? '') : '',
        tx.description ?? '',
        tx.notes ?? '',
      ]
        .map(cell)
        .join(';'),
    );
  }
  return BOM + lines.join('\r\n') + '\r\n';
}
