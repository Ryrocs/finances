/**
 * Calendar helpers on ISO strings ('YYYY-MM-DD' dates, 'YYYY-MM' months).
 * Calendar dates have no time zone, so arithmetic is done in UTC to avoid DST bugs.
 */

export type ISODate = string;
export type MonthKey = string;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;

export function isValidISODate(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo) && y >= 1900 && y <= 2200;
}

export function isValidMonthKey(value: string): boolean {
  const m = MONTH_RE.exec(value);
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12 && Number(m[1]) >= 1900 && Number(m[1]) <= 2200;
}

export function parseISODate(value: ISODate): { y: number; m: number; d: number } {
  const match = DATE_RE.exec(value);
  if (!match) throw new Error(`Invalid date: ${value}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

export function toISODate(y: number, m: number, d: number): ISODate {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** m is 1-based. */
export function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

function toUTC(value: ISODate): number {
  const { y, m, d } = parseISODate(value);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number): ISODate {
  const dt = new Date(ms);
  return toISODate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addDays(value: ISODate, days: number): ISODate {
  return fromUTC(toUTC(value) + days * 86_400_000);
}

/** Whole days from a to b (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86_400_000);
}

/**
 * Adds months keeping the anchor day, clamped to the end of shorter months:
 * Jan 31 + 1 → Feb 28 (or 29 in leap years), + 2 → Mar 31.
 */
export function addMonthsClamped(value: ISODate, months: number, anchorDay?: number): ISODate {
  const { y, m, d } = parseISODate(value);
  const day = anchorDay ?? d;
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return toISODate(ny, nm, Math.min(day, daysInMonth(ny, nm)));
}

export function monthOf(value: ISODate): MonthKey {
  return value.slice(0, 7);
}

export function monthStart(month: MonthKey): ISODate {
  return `${month}-01`;
}

export function monthEnd(month: MonthKey): ISODate {
  const [y, m] = month.split('-').map(Number);
  return toISODate(y, m, daysInMonth(y, m));
}

export function daysInMonthKey(month: MonthKey): number {
  const [y, m] = month.split('-').map(Number);
  return daysInMonth(y, m);
}

export function addMonthsToKey(month: MonthKey, n: number): MonthKey {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Inclusive list of months from `from` to `to`. */
export function monthsBetween(from: MonthKey, to: MonthKey): MonthKey[] {
  const out: MonthKey[] = [];
  let cur = from;
  while (cur <= to && out.length < 600) {
    out.push(cur);
    cur = addMonthsToKey(cur, 1);
  }
  return out;
}

export function compareISO(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minISO(a: ISODate, b: ISODate): ISODate {
  return a < b ? a : b;
}

export function maxISO(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b;
}

/** Today's calendar date in an IANA time zone (falls back to Europe/Madrid). */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): ISODate {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  }
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Local "today" in the browser. */
export function localToday(): ISODate {
  const now = new Date();
  return toISODate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
