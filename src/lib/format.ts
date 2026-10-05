/** Locale-aware date formatting for ISO calendar dates ('YYYY-MM-DD') and months ('YYYY-MM'). */
import { addDays, parseISODate } from './dates';

const cache = new Map<string, Intl.DateTimeFormat>();

function dtf(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = cache.get(key);
  if (!f) {
    // Calendar dates are interpreted in UTC so they never shift by a day.
    f = new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' });
    cache.set(key, f);
  }
  return f;
}

function utc(iso: string): Date {
  const { y, m, d } = parseISODate(iso);
  return new Date(Date.UTC(y, m - 1, d));
}

export type DateStyle = 'short' | 'medium' | 'long' | 'weekday' | 'dayMonth';

const DATE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { day: 'numeric', month: 'numeric', year: '2-digit' },
  medium: { day: 'numeric', month: 'short', year: 'numeric' },
  long: { day: 'numeric', month: 'long', year: 'numeric' },
  weekday: { weekday: 'long', day: 'numeric', month: 'long' },
  dayMonth: { day: 'numeric', month: 'short' },
};

export function formatDate(iso: string, locale: string, style: DateStyle = 'medium'): string {
  return dtf(locale, DATE_OPTIONS[style]).format(utc(iso));
}

export type MonthStyle = 'long' | 'short' | 'longYear' | 'shortYear';

export function formatMonth(month: string, locale: string, style: MonthStyle = 'longYear'): string {
  const date = utc(`${month}-01`);
  const options: Intl.DateTimeFormatOptions =
    style === 'long'
      ? { month: 'long' }
      : style === 'short'
        ? { month: 'short' }
        : style === 'shortYear'
          ? { month: 'short', year: '2-digit' }
          : { month: 'long', year: 'numeric' };
  // Standalone month names ("octubre", not "d’octubre").
  const parts = dtf(locale, options).formatToParts(date);
  const text = parts.map((p) => p.value).join('');
  return capitalize(text.replace(/^de\s+/i, '').replace(/^d’/i, ''));
}

export function capitalize(text: string): string {
  return text ? text.charAt(0).toLocaleUpperCase() + text.slice(1) : text;
}

/** "Today", "Yesterday" or a weekday + date. */
export function relativeDay(iso: string, today: string, locale: string, labels: { today: string; yesterday: string }): string {
  if (iso === today) return labels.today;
  if (iso === addDays(today, -1)) return labels.yesterday;
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return capitalize(
    dtf(locale, sameYear ? DATE_OPTIONS.weekday : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(utc(iso)),
  );
}

/** `value` is a percentage (13.1 → "13 %" in ca/es, "13%" in en). */
export function formatPercent(value: number, locale: string, { signed = false, digits = 0 } = {}): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(value / 100);
}
