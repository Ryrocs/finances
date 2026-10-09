/**
 * Account balances and liquid wealth.
 *
 *   balance(D) = initial balance (if its date ≤ D)
 *              + income - expenses - outgoing transfers + incoming transfers   (dated ≤ D)
 *
 * Every account is liquid, so liquid wealth is the sum of all balances. A transfer between two of
 * my accounts changes both balances and leaves the total untouched.
 */
import { addDays, diffDays, type ISODate } from '../dates';
import type { Account, Transaction } from '../types';

type AccountLike = Pick<Account, 'id' | 'initialBalanceCents' | 'initialBalanceDate'>;
type TxLike = Pick<Transaction, 'type' | 'amountCents' | 'accountId' | 'toAccountId' | 'date'>;

/** Effect of one movement on one account (positive = money in). */
export function movementEffect(tx: TxLike, accountId: string): number {
  if (tx.type === 'income') return tx.accountId === accountId ? tx.amountCents : 0;
  if (tx.type === 'expense') return tx.accountId === accountId ? -tx.amountCents : 0;
  let effect = 0;
  if (tx.accountId === accountId) effect -= tx.amountCents;
  if (tx.toAccountId === accountId) effect += tx.amountCents;
  return effect;
}

/** Balance of one account at the end of day `asOf`. */
export function balanceAsOf(account: AccountLike, txs: Iterable<TxLike>, asOf: ISODate): number {
  let balance = account.initialBalanceDate <= asOf ? account.initialBalanceCents : 0;
  for (const tx of txs) {
    if (tx.date <= asOf) balance += movementEffect(tx, account.id);
  }
  return balance;
}

/** Balances of every account at the end of `asOf`, in one pass over the movements. */
export function balancesAsOf(accounts: readonly AccountLike[], txs: Iterable<TxLike>, asOf: ISODate): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of accounts) out.set(a.id, a.initialBalanceDate <= asOf ? a.initialBalanceCents : 0);
  for (const tx of txs) {
    if (tx.date > asOf) continue;
    if (tx.type === 'income') addTo(out, tx.accountId, tx.amountCents);
    else if (tx.type === 'expense') addTo(out, tx.accountId, -tx.amountCents);
    else {
      addTo(out, tx.accountId, -tx.amountCents);
      if (tx.toAccountId) addTo(out, tx.toAccountId, tx.amountCents);
    }
  }
  return out;
}

function addTo(map: Map<string, number>, key: string, delta: number) {
  const current = map.get(key);
  if (current !== undefined) map.set(key, current + delta);
}

/** Liquid wealth = Σ balances of all accounts at the end of `asOf`. */
export function wealthAsOf(accounts: readonly AccountLike[], txs: Iterable<TxLike>, asOf: ISODate): number {
  let total = 0;
  for (const v of balancesAsOf(accounts, txs, asOf).values()) total += v;
  return total;
}

/** Earliest initial-balance date: before it there is no data at all. */
export function earliestStart(accounts: readonly AccountLike[]): ISODate | null {
  let min: ISODate | null = null;
  for (const a of accounts) if (min === null || a.initialBalanceDate < min) min = a.initialBalanceDate;
  return min;
}

export interface DailyPoint {
  date: ISODate;
  cents: number;
}

/**
 * Balance at the end of every day from `from` to `to` (inclusive), for a set of accounts
 * (all of them for liquid wealth, or a single one). Runs in O(days + movements).
 */
export function dailyBalances(accounts: readonly AccountLike[], txs: Iterable<TxLike>, from: ISODate, to: ISODate): DailyPoint[] {
  if (to < from) return [];
  const ids = new Set(accounts.map((a) => a.id));
  const days = diffDays(from, to) + 1;
  const deltas = new Array<number>(days).fill(0);
  let base = 0;

  const apply = (date: ISODate, delta: number) => {
    if (delta === 0 || date > to) return;
    if (date < from) base += delta;
    else deltas[diffDays(from, date)] += delta;
  };

  for (const a of accounts) apply(a.initialBalanceDate, a.initialBalanceCents);
  for (const tx of txs) {
    let delta = 0;
    if (tx.type === 'income') delta = ids.has(tx.accountId) ? tx.amountCents : 0;
    else if (tx.type === 'expense') delta = ids.has(tx.accountId) ? -tx.amountCents : 0;
    else {
      if (ids.has(tx.accountId)) delta -= tx.amountCents;
      if (tx.toAccountId && ids.has(tx.toAccountId)) delta += tx.amountCents;
    }
    apply(tx.date, delta);
  }

  const out: DailyPoint[] = [];
  let running = base;
  for (let i = 0; i < days; i++) {
    running += deltas[i];
    out.push({ date: addDays(from, i), cents: running });
  }
  return out;
}

/** Number of movements touching each account (as source or destination). */
export function movementCountByAccount(txs: Iterable<TxLike>): Map<string, number> {
  const out = new Map<string, number>();
  for (const tx of txs) {
    out.set(tx.accountId, (out.get(tx.accountId) ?? 0) + 1);
    if (tx.type === 'transfer' && tx.toAccountId && tx.toAccountId !== tx.accountId) {
      out.set(tx.toAccountId, (out.get(tx.toAccountId) ?? 0) + 1);
    }
  }
  return out;
}
