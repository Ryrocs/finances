import { describe, expect, it } from 'vitest';
import { accountSchema, fieldErrors, recurringSchema, signupSchema, transactionSchema } from '@/lib/validation';

const uuid = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

describe('validation', () => {
  it('accepts a complete expense and normalises optional fields', () => {
    const r = transactionSchema.safeParse({ type: 'expense', amountCents: 1250, date: '2026-10-05', accountId: uuid(1), categoryId: uuid(2) });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toMatchObject({ description: '', notes: null });
  });

  it('requires a category for expenses and income', () => {
    const r = transactionSchema.safeParse({ type: 'income', amountCents: 100, date: '2026-10-05', accountId: uuid(1) });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error)).toMatchObject({ categoryId: 'required' });
  });

  it('rejects transfers to the same account', () => {
    const r = transactionSchema.safeParse({ type: 'transfer', amountCents: 100, date: '2026-10-05', accountId: uuid(1), toAccountId: uuid(1) });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error)).toEqual({ toAccountId: 'same_account' });
  });

  it('rejects zero, negative, fractional and invalid dates', () => {
    for (const amountCents of [0, -5, 12.5]) {
      expect(transactionSchema.safeParse({ type: 'expense', amountCents, date: '2026-10-05', accountId: uuid(1), categoryId: uuid(2) }).success).toBe(false);
    }
    const r = transactionSchema.safeParse({ type: 'expense', amountCents: 100, date: '2026-02-30', accountId: uuid(1), categoryId: uuid(2) });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error)).toEqual({ date: 'invalid_date' });
  });

  it('validates sign-up input', () => {
    const r = signupSchema.safeParse({ email: 'not-an-email', password: 'short' });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error)).toEqual({ email: 'invalid_email', password: 'password_too_short' });
    const ok = signupSchema.safeParse({ email: '  Anna@Example.COM ', password: 'longenough' });
    expect(ok.success && ok.data.email).toBe('anna@example.com');
  });

  it('allows negative initial balances for accounts', () => {
    expect(accountSchema.safeParse({ name: 'Overdraft', type: 'checking', initialBalanceCents: -5000, initialBalanceDate: '2026-10-01', isLiquid: true }).success).toBe(true);
    const r = accountSchema.safeParse({ name: '  ', type: 'checking', initialBalanceCents: 0, initialBalanceDate: '2026-10-01', isLiquid: true });
    expect(!r.success && fieldErrors(r.error).name).toBe('required');
  });

  it('checks recurring end dates', () => {
    const r = recurringSchema.safeParse({
      type: 'expense',
      amountCents: 100,
      accountId: uuid(1),
      categoryId: uuid(2),
      frequency: 'monthly',
      startDate: '2026-10-01',
      endDate: '2026-09-01',
    });
    expect(!r.success && fieldErrors(r.error).endDate).toBe('end_before_start');
  });
});
