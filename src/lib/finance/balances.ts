/**
 * Account balances and liquid wealth.
 *
 *   balance = initial + income − expenses − outgoing transfers + incoming transfers
 *
 * Transfers move money between accounts: they change account balances but never cash flow,
 * and a transfer between two liquid accounts leaves liquid wealth unchanged.
 */
import type { TransactionType } from '../types';

export interface AccountFlows {
  incomeCents: number;
  expenseCents: number;
  transferOutCents: number;
  transferInCents: number;
}

export const EMPTY_FLOWS: AccountFlows = { incomeCents: 0, expenseCents: 0, transferOutCents: 0, transferInCents: 0 };

export function accountBalance(initialCents: number, flows: AccountFlows): number {
  return initialCents + flows.incomeCents - flows.expenseCents - flows.transferOutCents + flows.transferInCents;
}

export interface MovementLike {
  type: TransactionType;
  amountCents: number;
  accountId: string;
  toAccountId: string | null;
  date: string;
}

/** Effect of one movement on one account (positive = money in). */
export function movementEffect(m: MovementLike, accountId: string): number {
  if (m.type === 'income') return m.accountId === accountId ? m.amountCents : 0;
  if (m.type === 'expense') return m.accountId === accountId ? -m.amountCents : 0;
  let effect = 0;
  if (m.accountId === accountId) effect -= m.amountCents;
  if (m.toAccountId === accountId) effect += m.amountCents;
  return effect;
}

/** Aggregates movements dated ≤ asOf into flows for one account. */
export function flowsForAccount(movements: Iterable<MovementLike>, accountId: string, asOf?: string): AccountFlows {
  const flows = { ...EMPTY_FLOWS };
  for (const m of movements) {
    if (asOf && m.date > asOf) continue;
    if (m.type === 'income' && m.accountId === accountId) flows.incomeCents += m.amountCents;
    else if (m.type === 'expense' && m.accountId === accountId) flows.expenseCents += m.amountCents;
    else if (m.type === 'transfer') {
      if (m.accountId === accountId) flows.transferOutCents += m.amountCents;
      if (m.toAccountId === accountId) flows.transferInCents += m.amountCents;
    }
  }
  return flows;
}

export interface AccountForBalance {
  id: string;
  initialBalanceCents: number;
  initialBalanceDate: string;
  isLiquid: boolean;
}

/**
 * Balance of an account at the end of `asOf`. The initial balance applies from its date;
 * movements count from their own date.
 */
export function balanceAsOf(account: AccountForBalance, movements: Iterable<MovementLike>, asOf: string): number {
  const initial = account.initialBalanceDate <= asOf ? account.initialBalanceCents : 0;
  return accountBalance(initial, flowsForAccount(movements, account.id, asOf));
}

export function liquidWealth(accounts: Iterable<{ isLiquid: boolean; balanceCents: number }>): number {
  let total = 0;
  for (const a of accounts) if (a.isLiquid) total += a.balanceCents;
  return total;
}
