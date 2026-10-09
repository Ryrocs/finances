import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  clampDay,
  daysInMonthKey,
  diffDays,
  formatDayHeader,
  formatLongDate,
  formatMonthYear,
  formatShortDate,
  isValidISODate,
  monthEnd,
  monthsBetween,
  today,
  weekdayOf,
} from '../../src/lib/dates';

describe('calendar arithmetic', () => {
  it('adds days across months, years and DST changes', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(diffDays('2026-01-01', '2026-12-31')).toBe(364);
  });

  it('handles month keys', () => {
    expect(addMonths('2026-11', 2)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(monthEnd('2024-02')).toBe('2024-02-29');
    expect(monthEnd('2026-02')).toBe('2026-02-28');
    expect(daysInMonthKey('2026-10')).toBe(31);
    expect(monthsBetween('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
  });

  it('clamps day 31 to the last day of shorter months', () => {
    expect(clampDay('2026-02', 31)).toBe('2026-02-28');
    expect(clampDay('2024-02', 31)).toBe('2024-02-29');
    expect(clampDay('2026-04', 31)).toBe('2026-04-30');
    expect(clampDay('2026-05', 31)).toBe('2026-05-31');
  });

  it('weeks start on Monday', () => {
    expect(weekdayOf('2026-10-05')).toBe(1);
    expect(weekdayOf('2026-10-11')).toBe(7);
  });

  it('validates dates', () => {
    expect(isValidISODate('2026-02-29')).toBe(false);
    expect(isValidISODate('2024-02-29')).toBe(true);
    expect(isValidISODate('2026-13-01')).toBe(false);
    expect(isValidISODate('26-10-01')).toBe(false);
  });

  it("uses the device's local calendar for today, not UTC", () => {
    // 00:30 local time on 5 October is still 5 October whatever the UTC date is.
    expect(today(new Date(2026, 9, 5, 0, 30))).toBe('2026-10-05');
    expect(today(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05');
  });
});

describe('Catalan formatting', () => {
  it('formats day headers', () => {
    expect(formatDayHeader('2026-10-05')).toBe("dl., 5 d'oct.");
    expect(formatDayHeader('2026-10-11')).toBe("dg., 11 d'oct.");
    expect(formatDayHeader('2026-03-04')).toBe('dc., 4 de març');
    expect(formatDayHeader('2026-08-07')).toBe("dv., 7 d'ag.");
    expect(formatDayHeader('2026-01-01')).toBe('dj., 1 de gen.');
  });

  it('formats months', () => {
    expect(formatMonthYear('2026-10')).toBe('Octubre 2026');
    expect(formatMonthYear('2026-10', false)).toBe('octubre 2026');
    expect(formatMonthYear('2026-03')).toBe('Març 2026');
  });

  it('formats dates', () => {
    expect(formatLongDate('2026-04-05')).toBe("5 d'abril de 2026");
    expect(formatLongDate('2026-12-24')).toBe('24 de desembre de 2026');
    expect(formatShortDate('2026-10-05', 2026)).toBe("5 d'oct.");
    expect(formatShortDate('2025-10-05', 2026)).toBe("5 d'oct. 2025");
  });
});
