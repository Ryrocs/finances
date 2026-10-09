/**
 * Calendar helpers on plain strings: dates are 'YYYY-MM-DD' and months 'YYYY-MM', always in the
 * device's local calendar. Arithmetic goes through UTC so daylight-saving changes can't shift a day.
 * Never use `new Date().toISOString()` for a movement date: it returns the UTC day.
 */

export type ISODate = string;
export type MonthKey = string;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;

export function toISODate(y: number, m: number, d: number): ISODate {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function parseISODate(value: ISODate): { y: number; m: number; d: number } {
  const match = DATE_RE.exec(value);
  if (!match) throw new Error(`Data no vàlida: ${value}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

export function isValidISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string') return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return y >= 1900 && y <= 2200 && mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

export function isValidMonthKey(value: unknown): value is MonthKey {
  if (typeof value !== 'string') return false;
  const m = MONTH_RE.exec(value);
  return !!m && Number(m[1]) >= 1900 && Number(m[1]) <= 2200 && Number(m[2]) >= 1 && Number(m[2]) <= 12;
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

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function weekdayOf(value: ISODate): number {
  const day = new Date(toUTC(value)).getUTCDay();
  return day === 0 ? 7 : day;
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

export function addMonths(month: MonthKey, n: number): MonthKey {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Inclusive list of months from `from` to `to`. */
export function monthsBetween(from: MonthKey, to: MonthKey): MonthKey[] {
  const out: MonthKey[] = [];
  for (let cur = from; cur <= to && out.length < 1200; cur = addMonths(cur, 1)) out.push(cur);
  return out;
}

/** Day `day` of a month, clamped to its last day (31 → 28/29 in February). */
export function clampDay(month: MonthKey, day: number): ISODate {
  const [y, m] = month.split('-').map(Number);
  return toISODate(y, m, Math.min(day, daysInMonth(y, m)));
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a < b ? a : b;
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b;
}

/** Today in the device's local calendar (not UTC). */
export function today(now: Date = new Date()): ISODate {
  return toISODate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function currentMonth(now: Date = new Date()): MonthKey {
  return monthOf(today(now));
}

// ——— Catalan names (hard-coded so they never depend on the browser's locale data) ———

export const MONTHS = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'];
export const MONTHS_SHORT = ['gen.', 'febr.', 'març', 'abr.', 'maig', 'juny', 'jul.', 'ag.', 'set.', 'oct.', 'nov.', 'des.'];
/** Index 0 = Monday. */
export const WEEKDAYS = ['dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte', 'diumenge'];
export const WEEKDAYS_SHORT = ['dl.', 'dt.', 'dc.', 'dj.', 'dv.', 'ds.', 'dg.'];

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "de març" / "d'abril": the preposition elides before a vowel. */
function ofMonth(name: string): string {
  return /^[aeiouàèéíòóú]/i.test(name) ? `d'${name}` : `de ${name}`;
}

/** "Octubre 2026" (or "octubre 2026" with capitalized = false). */
export function formatMonthYear(month: MonthKey, capitalized = true): string {
  const [y, m] = month.split('-').map(Number);
  const label = `${MONTHS[m - 1]} ${y}`;
  return capitalized ? capitalize(label) : label;
}

/** "oct. 26" — chart axes. */
export function formatMonthShort(month: MonthKey, withYear = true): string {
  const [y, m] = month.split('-').map(Number);
  const name = MONTHS_SHORT[m - 1];
  return withYear ? `${name} ${String(y).slice(2)}` : name;
}

/** "dl., 5 d'oct." — day headers in the movement list. */
export function formatDayHeader(value: ISODate): string {
  const { m, d } = parseISODate(value);
  return `${WEEKDAYS_SHORT[weekdayOf(value) - 1]}, ${d} ${ofMonth(MONTHS_SHORT[m - 1])}`;
}

/** "5 d'oct." / "5 d'oct. 2025" when not in the current year. */
export function formatShortDate(value: ISODate, referenceYear?: number): string {
  const { y, m, d } = parseISODate(value);
  const base = `${d} ${ofMonth(MONTHS_SHORT[m - 1])}`;
  return referenceYear !== undefined && y !== referenceYear ? `${base} ${y}` : base;
}

/** "5 d'octubre de 2026". */
export function formatLongDate(value: ISODate): string {
  const { y, m, d } = parseISODate(value);
  return `${d} ${ofMonth(MONTHS[m - 1])} de ${y}`;
}

/** "Dilluns, 5 d'octubre de 2026". */
export function formatFullDate(value: ISODate): string {
  return `${capitalize(WEEKDAYS[weekdayOf(value) - 1])}, ${formatLongDate(value)}`;
}

/** "05/10/2026". */
export function formatNumericDate(value: ISODate): string {
  const { y, m, d } = parseISODate(value);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}
