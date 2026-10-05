/**
 * Recurring schedule maths. Occurrence k is computed from the start date (not from the previous
 * occurrence), so a rule on the 31st yields Jan 31, Feb 28/29, Mar 31… without drifting.
 */
import { addDays, addMonthsClamped, parseISODate } from '../dates';
import type { Frequency } from '../types';

export interface Schedule {
  frequency: Frequency;
  interval: number;
  startDate: string;
  endDate: string | null;
}

/** Safety cap so a malformed rule can never generate an unbounded number of rows. */
export const MAX_OCCURRENCES_PER_RUN = 500;

export function occurrenceAt(schedule: Schedule, k: number): string {
  const step = Math.max(1, schedule.interval);
  if (schedule.frequency === 'weekly') return addDays(schedule.startDate, 7 * step * k);
  const anchorDay = parseISODate(schedule.startDate).d;
  const months = schedule.frequency === 'monthly' ? step * k : 12 * step * k;
  return addMonthsClamped(schedule.startDate, months, anchorDay);
}

/**
 * Occurrences strictly after `after` (or from the start when null) and up to `until` inclusive,
 * bounded by the end date.
 */
export function occurrencesBetween(schedule: Schedule, after: string | null, until: string): string[] {
  const out: string[] = [];
  const limit = schedule.endDate && schedule.endDate < until ? schedule.endDate : until;
  for (let k = 0; k < 100_000 && out.length < MAX_OCCURRENCES_PER_RUN; k++) {
    const date = occurrenceAt(schedule, k);
    if (date > limit) break;
    if (after === null || date > after) out.push(date);
  }
  return out;
}

/** Next occurrence strictly after `after` (or the first one), or null if the rule has ended. */
export function nextOccurrence(schedule: Schedule, after: string | null): string | null {
  for (let k = 0; k < 100_000; k++) {
    const date = occurrenceAt(schedule, k);
    if (schedule.endDate && date > schedule.endDate) return null;
    if (after === null || date > after) return date;
  }
  return null;
}
