import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonthsClamped,
  addMonthsToKey,
  daysInMonth,
  diffDays,
  isLeapYear,
  isValidISODate,
  monthEnd,
  monthsBetween,
  todayInTimeZone,
} from '@/lib/dates';

describe('calendar helpers', () => {
  it('knows month lengths and leap years', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2100, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(isLeapYear(2024)).toBe(true);
    expect(monthEnd('2026-04')).toBe('2026-04-30');
    expect(monthEnd('2028-02')).toBe('2028-02-29');
  });

  it('validates ISO dates strictly', () => {
    expect(isValidISODate('2026-02-29')).toBe(false);
    expect(isValidISODate('2028-02-29')).toBe(true);
    expect(isValidISODate('2026-13-01')).toBe(false);
    expect(isValidISODate('2026-1-01')).toBe(false);
  });

  it('adds days across month/year boundaries and DST changes', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30'); // DST in Europe
    expect(diffDays('2026-03-01', '2026-04-01')).toBe(31);
    expect(diffDays('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('clamps month arithmetic to the end of shorter months', () => {
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonthsClamped('2026-01-31', 2, 31)).toBe('2026-03-31');
    expect(addMonthsClamped('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonthsClamped('2026-11-15', 3)).toBe('2027-02-15');
  });

  it('iterates months', () => {
    expect(addMonthsToKey('2026-01', -1)).toBe('2025-12');
    expect(monthsBetween('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('computes "today" in the user time zone', () => {
    const lateUtc = new Date('2026-10-05T23:30:00Z');
    expect(todayInTimeZone('Europe/Madrid', lateUtc)).toBe('2026-10-06');
    expect(todayInTimeZone('America/New_York', lateUtc)).toBe('2026-10-05');
    expect(todayInTimeZone('Not/AZone', lateUtc)).toBe('2026-10-06');
  });
});
