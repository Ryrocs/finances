import type { Account, Transaction } from '../../src/lib/types';

let seq = 0;

export function account(partial: Partial<Account> & Pick<Account, 'id'>): Account {
  return {
    name: partial.id,
    type: 'corrent',
    color: '#6366F1',
    initialBalanceCents: 0,
    initialBalanceDate: '2026-01-01',
    order: 0,
    createdAt: 0,
    ...partial,
  };
}

export function tx(partial: Partial<Transaction> & Pick<Transaction, 'type' | 'amountCents' | 'date'>): Transaction {
  seq++;
  return {
    id: `t${seq}`,
    accountId: 'a',
    categoryId: partial.type === 'transfer' ? undefined : 'cat',
    source: 'manual',
    createdAt: seq,
    updatedAt: seq,
    ...partial,
  };
}
