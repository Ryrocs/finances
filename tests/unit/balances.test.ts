import { describe, expect, it } from 'vitest';
import { balanceAsOf, balancesAsOf, dailyBalances, earliestStart, movementCountByAccount, wealthAsOf } from '../../src/lib/finance/balances';
import { account, tx } from './helpers';

const checking = account({ id: 'a', initialBalanceCents: 100000, initialBalanceDate: '2026-08-01' });
const savings = account({ id: 's', type: 'remunerat', initialBalanceCents: 500000, initialBalanceDate: '2026-08-10' });
const txs = [
  tx({ type: 'income', amountCents: 200000, date: '2026-08-05', accountId: 'a' }),
  tx({ type: 'expense', amountCents: 2450, date: '2026-08-06', accountId: 'a' }),
  tx({ type: 'transfer', amountCents: 50000, date: '2026-08-15', accountId: 'a', toAccountId: 's' }),
  tx({ type: 'expense', amountCents: 1000, date: '2026-09-01', accountId: 's' }),
];

describe('account balances', () => {
  it('initial + income − expenses − transfers out + transfers in', () => {
    expect(balanceAsOf(checking, txs, '2026-09-30')).toBe(100000 + 200000 - 2450 - 50000);
    expect(balanceAsOf(savings, txs, '2026-09-30')).toBe(500000 + 50000 - 1000);
  });

  it('only counts what happened up to the date', () => {
    expect(balanceAsOf(checking, txs, '2026-08-05')).toBe(300000);
    expect(balanceAsOf(checking, txs, '2026-07-31')).toBe(0);
    // The initial balance applies from its own date.
    expect(balanceAsOf(savings, txs, '2026-08-09')).toBe(0);
    expect(balanceAsOf(savings, txs, '2026-08-10')).toBe(500000);
  });

  it('computes every account at once', () => {
    const map = balancesAsOf([checking, savings], txs, '2026-09-30');
    expect(map.get('a')).toBe(247550);
    expect(map.get('s')).toBe(549000);
  });

  it('a transfer between my accounts leaves liquid wealth unchanged', () => {
    expect(wealthAsOf([checking, savings], txs, '2026-08-14')).toBe(wealthAsOf([checking, savings], txs, '2026-08-15'));
    expect(wealthAsOf([checking, savings], txs, '2026-09-30')).toBe(247550 + 549000);
  });

  it('builds daily balances that match balanceAsOf every day', () => {
    const days = dailyBalances([checking, savings], txs, '2026-07-30', '2026-09-02');
    expect(days[0]).toEqual({ date: '2026-07-30', cents: 0 });
    for (const d of days) expect(d.cents).toBe(wealthAsOf([checking, savings], txs, d.date));
    const single = dailyBalances([savings], txs, '2026-08-01', '2026-09-30');
    for (const d of single) expect(d.cents).toBe(balanceAsOf(savings, txs, d.date));
  });

  it('knows where the data starts', () => {
    expect(earliestStart([savings, checking])).toBe('2026-08-01');
    expect(earliestStart([])).toBeNull();
  });

  it('counts the movements of each account, transfers on both sides', () => {
    const counts = movementCountByAccount(txs);
    expect(counts.get('a')).toBe(3);
    expect(counts.get('s')).toBe(2);
  });
});
