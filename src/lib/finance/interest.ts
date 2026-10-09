/**
 * Monthly interest of a savings ('remunerat') account.
 *
 *   TIN   = 12 × ((1 + TAE/100)^(1/12) - 1)
 *   gross = Σ (balance at the end of each day of the month × TIN / 365)
 *   net   = gross × (1 - withholding/100), rounded to cents
 *
 * One income movement per finished month, dated on its last day. Never daily.
 */
import { addMonths, monthEnd, monthOf, monthStart, type ISODate, type MonthKey } from '../dates';
import type { Account, Transaction } from '../types';
import { dailyBalances } from './balances';

export const DEFAULT_WITHHOLDING_PCT = 19;

/** Nominal annual rate (as a fraction) equivalent to a TAE in %. */
export function tinFromTae(tae: number): number {
  return 12 * ((1 + tae / 100) ** (1 / 12) - 1);
}

type AccountLike = Pick<Account, 'id' | 'initialBalanceCents' | 'initialBalanceDate' | 'tae' | 'withholdingPct'>;
type TxLike = Pick<Transaction, 'type' | 'amountCents' | 'accountId' | 'toAccountId' | 'date'>;

export interface MonthInterest {
  month: MonthKey;
  /** Unrounded gross interest in cents. */
  grossCents: number;
  /** Rounded net interest in cents. */
  netCents: number;
}

export function monthlyInterest(account: AccountLike, txs: Iterable<TxLike>, month: MonthKey): MonthInterest {
  const tae = account.tae ?? 0;
  if (tae <= 0) return { month, grossCents: 0, netCents: 0 };
  const dailyRate = tinFromTae(tae) / 365;
  let grossCents = 0;
  for (const day of dailyBalances([account], txs, monthStart(month), monthEnd(month))) {
    // A negative balance earns nothing (and is never charged here).
    if (day.cents > 0) grossCents += day.cents * dailyRate;
  }
  const withholding = account.withholdingPct ?? DEFAULT_WITHHOLDING_PCT;
  const netCents = Math.round(grossCents * (1 - withholding / 100));
  return { month, grossCents, netCents: Math.max(0, netCents) };
}

/**
 * Finished months whose interest hasn't been generated yet: from the month of the initial balance
 * (or the month after the last processed one) up to the month before today's.
 */
export function pendingInterestMonths(account: Pick<Account, 'type' | 'tae' | 'initialBalanceDate'>, lastProcessed: MonthKey | undefined, today: ISODate): MonthKey[] {
  if (account.type !== 'remunerat' || !account.tae || account.tae <= 0) return [];
  const lastFinished = addMonths(monthOf(today), -1);
  const first = lastProcessed ? addMonths(lastProcessed, 1) : monthOf(account.initialBalanceDate);
  const out: MonthKey[] = [];
  for (let m = first; m <= lastFinished && out.length < 600; m = addMonths(m, 1)) out.push(m);
  return out;
}

export function interestTransactionId(accountId: string, month: MonthKey): string {
  return `int_${accountId}_${month}`;
}
