import { describe, expect, it } from 'vitest';
import { filterMovements } from '../../src/lib/filters';
import { hasErrors, parsePercent, validateAccount, validateMovement, validateSchedule } from '../../src/lib/validation';
import { account, tx } from './helpers';

const accounts = [account({ id: 'a', name: 'Compte corrent', initialBalanceDate: '2026-08-01' }), account({ id: 'b', name: 'Efectiu', initialBalanceDate: '2026-09-01' })];
const categories = [
  { id: 'food', kind: 'expense' as const },
  { id: 'job', kind: 'income' as const },
];
const base = { type: 'expense' as const, date: '2026-10-05', amountCents: 2450, categoryId: 'food', accountId: 'a' };

describe('validateMovement', () => {
  it('accepts a valid expense, income and transfer', () => {
    expect(hasErrors(validateMovement(base, accounts, categories))).toBe(false);
    expect(hasErrors(validateMovement({ ...base, type: 'income', categoryId: 'job' }, accounts, categories))).toBe(false);
    expect(hasErrors(validateMovement({ ...base, type: 'transfer', categoryId: undefined, toAccountId: 'b' }, accounts, categories))).toBe(false);
  });

  it('rejects empty, zero or negative amounts', () => {
    expect(validateMovement({ ...base, amountCents: null }, accounts, categories).amount).toBeTruthy();
    expect(validateMovement({ ...base, amountCents: 0 }, accounts, categories).amount).toBeTruthy();
    expect(validateMovement({ ...base, amountCents: -100 }, accounts, categories).amount).toBeTruthy();
  });

  it('requires a category of the right kind and an account', () => {
    expect(validateMovement({ ...base, categoryId: undefined }, accounts, categories).category).toBeTruthy();
    expect(validateMovement({ ...base, categoryId: 'job' }, accounts, categories).category).toBeTruthy();
    expect(validateMovement({ ...base, accountId: undefined }, accounts, categories).account).toBeTruthy();
  });

  it('rejects a transfer to the same account', () => {
    expect(validateMovement({ ...base, type: 'transfer', toAccountId: 'a' }, accounts, categories).toAccount).toBeTruthy();
    expect(validateMovement({ ...base, type: 'transfer', toAccountId: undefined }, accounts, categories).toAccount).toBeTruthy();
  });

  it('rejects a date before the initial balance of either account', () => {
    expect(validateMovement({ ...base, date: '2026-07-31' }, accounts, categories).date).toContain('Compte corrent');
    expect(validateMovement({ ...base, type: 'transfer', toAccountId: 'b', date: '2026-08-15' }, accounts, categories).date).toContain('Efectiu');
  });
});

describe('other validations', () => {
  it('end date not before start', () => {
    expect(validateSchedule({ frequency: 'monthly', startDate: '2026-10-01', endDate: '2026-09-30' }).endDate).toBeTruthy();
    expect(validateSchedule({ frequency: 'monthly', startDate: '2026-10-01' }).endDate).toBeUndefined();
  });

  it('accounts', () => {
    const ok = { name: 'Compte', type: 'remunerat' as const, color: '#000', initialBalanceCents: 0, initialBalanceDate: '2026-10-01', tae: 2.5, withholdingPct: 19 };
    expect(hasErrors(validateAccount(ok))).toBe(false);
    expect(validateAccount({ ...ok, name: ' ' }).name).toBeTruthy();
    expect(validateAccount({ ...ok, tae: Number.NaN }).tae).toBeTruthy();
    expect(validateAccount({ ...ok, withholdingPct: 120 }).withholdingPct).toBeTruthy();
    // The initial date can't move past existing movements.
    expect(validateAccount(ok, '2026-09-15').initialBalanceDate).toBeTruthy();
  });

  it('parses percentages with a comma', () => {
    expect(parsePercent('2,5')).toBe(2.5);
    expect(parsePercent('19')).toBe(19);
    expect(parsePercent('')).toBeNull();
    expect(parsePercent('abc')).toBeNaN();
  });
});

describe('filterMovements', () => {
  const list = [
    tx({ type: 'expense', amountCents: 100, date: '2026-10-02', description: 'Cafè amb la Marta', categoryId: 'food' }),
    tx({ type: 'income', amountCents: 100, date: '2026-10-03', categoryId: 'job', notes: 'nòmina' }),
    tx({ type: 'transfer', amountCents: 100, date: '2026-10-04', accountId: 'a', toAccountId: 'b' }),
    tx({ type: 'expense', amountCents: 100, date: '2026-09-30', categoryId: 'food' }),
  ];

  it('shows the month, newest first', () => {
    expect(filterMovements(list, '2026-10', {}).map((t) => t.date)).toEqual(['2026-10-04', '2026-10-03', '2026-10-02']);
  });

  it('searches description and notes ignoring accents and case', () => {
    expect(filterMovements(list, '2026-10', { query: 'cafe' })).toHaveLength(1);
    expect(filterMovements(list, '2026-10', { query: 'NOMINA' })).toHaveLength(1);
  });

  it('filters by type, category, account (both sides of a transfer) and date range', () => {
    expect(filterMovements(list, '2026-10', { type: 'income' })).toHaveLength(1);
    expect(filterMovements(list, '2026-10', { categoryId: 'food' })).toHaveLength(1);
    expect(filterMovements(list, '2026-10', { accountId: 'b' })).toHaveLength(1);
    // A date range replaces the month.
    expect(filterMovements(list, '2026-10', { from: '2026-09-01', to: '2026-10-02' })).toHaveLength(2);
  });
});
