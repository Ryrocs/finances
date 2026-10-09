import { beforeEach, describe, expect, it } from 'vitest';
import { runAutomation } from '../../src/db/automation';
import { FinancesDB } from '../../src/db/db';
import * as repo from '../../src/db/repo';
import { nextOccurrence, occurrencesBetween, pendingOccurrences, resumeFrom } from '../../src/lib/finance/recurring';
import type { RecurringRule } from '../../src/lib/types';

function rule(partial: Partial<RecurringRule>): RecurringRule {
  return {
    id: 'r',
    type: 'expense',
    amountCents: 1000,
    categoryId: 'cat_subscripcions',
    accountId: 'a',
    frequency: 'monthly',
    startDate: '2026-01-31',
    active: true,
    createdAt: 0,
    ...partial,
  };
}

describe('recurring schedules', () => {
  it('day 31 falls on the last day of shorter months, without drifting', () => {
    expect(occurrencesBetween(rule({ dayOfMonth: 31 }), '2026-01-01', '2026-05-31')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
    expect(occurrencesBetween(rule({ dayOfMonth: 31, startDate: '2024-01-15' }), '2024-02-01', '2024-02-29')).toEqual(['2024-02-29']);
  });

  it('respects the start and the end date', () => {
    const r = rule({ startDate: '2026-03-10', dayOfMonth: 5, endDate: '2026-06-05' });
    expect(occurrencesBetween(r, '2026-01-01', '2026-12-31')).toEqual(['2026-04-05', '2026-05-05', '2026-06-05']);
  });

  it('weekly rules land on the chosen weekday', () => {
    // 2026-10-01 is a Thursday; weekday 1 = Monday.
    expect(occurrencesBetween(rule({ frequency: 'weekly', weekday: 1, startDate: '2026-10-01' }), '2026-10-01', '2026-10-20')).toEqual(['2026-10-05', '2026-10-12', '2026-10-19']);
  });

  it('yearly rules repeat on the start date, clamped in non-leap years', () => {
    expect(occurrencesBetween(rule({ frequency: 'yearly', startDate: '2024-02-29' }), '2024-01-01', '2027-12-31')).toEqual(['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28']);
  });

  it('only what is pending since the last generated date', () => {
    const r = rule({ dayOfMonth: 15, startDate: '2026-07-15', lastGeneratedDate: '2026-08-15' });
    expect(pendingOccurrences(r, '2026-10-09')).toEqual(['2026-09-15']);
    expect(pendingOccurrences({ ...r, active: false }, '2026-10-09')).toEqual([]);
    expect(nextOccurrence({ ...r, lastGeneratedDate: '2026-09-15' }, '2026-10-09')).toBe('2026-10-15');
    expect(nextOccurrence(rule({ endDate: '2026-02-28', dayOfMonth: 31, lastGeneratedDate: '2026-02-28' }), '2026-10-09')).toBeNull();
  });

  it('resuming skips the paused period', () => {
    const r = rule({ dayOfMonth: 1, startDate: '2026-01-01', lastGeneratedDate: '2026-05-01', active: false });
    const resumed = { ...r, active: true, lastGeneratedDate: resumeFrom(r, '2026-10-09') };
    expect(pendingOccurrences(resumed, '2026-10-09')).toEqual([]);
    expect(nextOccurrence(resumed, '2026-10-09')).toBe('2026-11-01');
  });
});

describe('recurring generation in the database', () => {
  let db: FinancesDB;
  let account: string;

  beforeEach(async () => {
    db = new FinancesDB(`rec-${Math.random()}`);
    repo.setDatabase(db);
    await repo.ensureSeed();
    account = await repo.createAccount({ name: 'Compte corrent', type: 'corrent', color: '#000', initialBalanceCents: 100000, initialBalanceDate: '2026-01-01' });
  });

  const monthly = (startDate: string, extra: Partial<repo.RuleData> = {}): repo.RuleData => ({
    type: 'expense',
    date: startDate,
    startDate,
    amountCents: 999,
    categoryId: 'cat_subscripcions',
    accountId: account,
    frequency: 'monthly',
    dayOfMonth: Number(startDate.slice(8, 10)),
    ...extra,
  });

  it('creates the past occurrences at once, and never duplicates them', async () => {
    const { id, generated } = await repo.createRule(monthly('2026-07-31', { dayOfMonth: 31 }), '2026-10-09');
    expect(generated).toBe(3);
    const dates = (await db.transactions.toArray()).map((t) => t.date).sort();
    expect(dates).toEqual(['2026-07-31', '2026-08-31', '2026-09-30']);
    // Opening the app again (twice, even concurrently) creates nothing new.
    await Promise.all([runAutomation('2026-10-09', db), runAutomation('2026-10-09', db)]);
    expect(await db.transactions.count()).toBe(3);
    expect((await db.recurringRules.get(id))?.lastGeneratedDate).toBe('2026-09-30');
  });

  it('catches up the days the app was not opened', async () => {
    await repo.createRule(monthly('2026-09-05'), '2026-09-10');
    expect(await db.transactions.count()).toBe(1);
    const result = await runAutomation('2027-01-20', db);
    expect(result.recurringCreated).toBe(4);
    expect((await db.transactions.toArray()).map((t) => t.date).sort()).toEqual(['2026-09-05', '2026-10-05', '2026-11-05', '2026-12-05', '2027-01-05']);
  });

  it('stops at the end date', async () => {
    await repo.createRule(monthly('2026-06-01', { endDate: '2026-08-15' }), '2026-10-09');
    expect((await db.transactions.toArray()).map((t) => t.date).sort()).toEqual(['2026-06-01', '2026-07-01', '2026-08-01']);
  });

  it('a deleted or edited generated movement is not recreated', async () => {
    await repo.createRule(monthly('2026-08-01'), '2026-10-09');
    const [first, second] = (await db.transactions.orderBy('date').toArray()).map((t) => t.id);
    await repo.deleteMovement(first);
    await repo.saveMovement({ type: 'expense', date: '2026-09-01', amountCents: 5000, categoryId: 'cat_subscripcions', accountId: account }, second);
    await runAutomation('2026-10-09', db);
    const rows = await db.transactions.orderBy('date').toArray();
    expect(rows.map((t) => t.date)).toEqual(['2026-09-01', '2026-10-01']);
    expect(rows[0].amountCents).toBe(5000);
    expect(rows[0].source).toBe('recurring');
  });

  it('deleting a rule keeps its movements; pausing stops new ones', async () => {
    const { id } = await repo.createRule(monthly('2026-09-01'), '2026-10-09');
    await repo.setRuleActive(id, false, '2026-10-09');
    await runAutomation('2026-12-15', db);
    expect(await db.transactions.count()).toBe(2);
    await repo.setRuleActive(id, true, '2026-12-15');
    await runAutomation('2027-01-02', db);
    expect((await db.transactions.toArray()).map((t) => t.date).sort()).toEqual(['2026-09-01', '2026-10-01', '2027-01-01']);
    await repo.deleteRule(id);
    expect(await db.transactions.count()).toBe(3);
  });

  it('recurring transfers move money between accounts', async () => {
    const savings = await repo.createAccount({ name: 'Remunerat', type: 'remunerat', color: '#111', initialBalanceCents: 0, initialBalanceDate: '2026-01-01', tae: 2 });
    await repo.createRule(monthly('2026-10-01', { type: 'transfer', categoryId: undefined, toAccountId: savings, amountCents: 20000 }), '2026-10-09');
    const [t] = await db.transactions.toArray();
    expect(t).toMatchObject({ type: 'transfer', accountId: account, toAccountId: savings, categoryId: undefined, source: 'recurring' });
  });
});
