/**
 * Recurring schedules. Occurrences are derived from the rule itself (not from the previous
 * occurrence), so a rule on the 31st yields Jan 31, Feb 28/29, Mar 31… without drifting.
 */
import { addDays, clampDay, maxDate, minDate, monthOf, monthsBetween, parseISODate, weekdayOf, type ISODate } from '../dates';
import type { RecurringRule } from '../types';

type Schedule = Pick<RecurringRule, 'frequency' | 'dayOfMonth' | 'weekday' | 'startDate' | 'endDate'>;

/** Safety cap so a malformed rule can never create an unbounded number of rows in one run. */
export const MAX_OCCURRENCES = 1000;

export function ruleDay(rule: Schedule): number {
  return rule.dayOfMonth ?? parseISODate(rule.startDate).d;
}

export function ruleWeekday(rule: Schedule): number {
  return rule.weekday ?? weekdayOf(rule.startDate);
}

/** Occurrences of the rule between `from` and `to` (both inclusive), never before the start or after the end. */
export function occurrencesBetween(rule: Schedule, from: ISODate, to: ISODate): ISODate[] {
  const start = maxDate(rule.startDate, from);
  const end = rule.endDate ? minDate(rule.endDate, to) : to;
  if (end < start) return [];
  const out: ISODate[] = [];

  if (rule.frequency === 'weekly') {
    const wanted = ruleWeekday(rule);
    let date = addDays(start, (wanted - weekdayOf(start) + 7) % 7);
    while (date <= end && out.length < MAX_OCCURRENCES) {
      out.push(date);
      date = addDays(date, 7);
    }
    return out;
  }

  const day = ruleDay(rule);
  const yearlyMonth = rule.startDate.slice(5, 7);
  for (const month of monthsBetween(monthOf(start), monthOf(end))) {
    if (rule.frequency === 'yearly' && month.slice(5, 7) !== yearlyMonth) continue;
    const date = clampDay(month, day);
    if (date >= start && date <= end) out.push(date);
    if (out.length >= MAX_OCCURRENCES) break;
  }
  return out;
}

/** Occurrences still to be generated up to `today` (after `lastGeneratedDate`). */
export function pendingOccurrences(rule: RecurringRule, today: ISODate): ISODate[] {
  if (!rule.active) return [];
  const from = rule.lastGeneratedDate ? addDays(rule.lastGeneratedDate, 1) : rule.startDate;
  return occurrencesBetween(rule, from, today);
}

/** Next occurrence not generated yet (looking far enough ahead for a yearly rule), or null if the rule has ended. */
export function nextOccurrence(rule: RecurringRule, today: ISODate): ISODate | null {
  const from = rule.lastGeneratedDate ? addDays(rule.lastGeneratedDate, 1) : rule.startDate;
  return occurrencesBetween(rule, from, addDays(maxDate(from, today), 800))[0] ?? null;
}

/**
 * When a paused rule is resumed it continues from today: the occurrences of the paused period
 * are skipped, not created retroactively.
 */
export function resumeFrom(rule: RecurringRule, today: ISODate): ISODate | undefined {
  const yesterday = addDays(today, -1);
  if (yesterday < rule.startDate) return rule.lastGeneratedDate;
  return rule.lastGeneratedDate && rule.lastGeneratedDate > yesterday ? rule.lastGeneratedDate : yesterday;
}

/** Deterministic id of the movement generated for one occurrence: the same occurrence can never be created twice. */
export function recurringTransactionId(ruleId: string, date: ISODate): string {
  return `rec_${ruleId}_${date}`;
}
