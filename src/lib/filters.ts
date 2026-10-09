import { monthOf, type ISODate } from './dates';
import type { Transaction, TransactionType } from './types';

export interface MovementFilters {
  type?: TransactionType;
  categoryId?: string;
  accountId?: string;
  from?: ISODate;
  to?: ISODate;
  query?: string;
}

/** Lower-case without accents, so "cafe" finds "Cafè". */
export function normalizeSearch(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

/** Movements visible with the given month and filters, newest first. A date range replaces the month. */
export function filterMovements(txs: readonly Transaction[], month: string, f: MovementFilters): Transaction[] {
  const query = f.query ? normalizeSearch(f.query) : '';
  const useRange = !!(f.from || f.to);
  return txs
    .filter((tx) => {
      if (useRange) {
        if (f.from && tx.date < f.from) return false;
        if (f.to && tx.date > f.to) return false;
      } else if (monthOf(tx.date) !== month) return false;
      if (f.type && tx.type !== f.type) return false;
      if (f.categoryId && tx.categoryId !== f.categoryId) return false;
      if (f.accountId && tx.accountId !== f.accountId && tx.toAccountId !== f.accountId) return false;
      if (query && !normalizeSearch(`${tx.description ?? ''} ${tx.notes ?? ''}`).includes(query)) return false;
      return true;
    })
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
}
