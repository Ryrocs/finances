/**
 * Money helpers. Every amount is an integer number of cents. Floats are never stored: input is
 * parsed digit by digit and we only divide by 100 to display.
 */

/** 9.999.999.999,99 € — far above any personal balance and far below MAX_SAFE_INTEGER. */
export const MAX_AMOUNT_CENTS = 999_999_999_999;

/** Non-breaking space so "1.831,57 €" never wraps between the number and the symbol. */
const NBSP = '\u00A0';
/** Typographic minus sign. */
export const MINUS = '\u2212';

/**
 * Parses what a person types into cents. Accepts a decimal comma or point:
 * "24,50" "24.5" "1.234,56" "1234" "€ 12" → 2450, 2450, 123456, 123400, 1200.
 * A separator followed by exactly three digits is a thousands separator ("1.234" → 1234 €),
 * because euros have two decimals. Returns null for anything that isn't a valid amount.
 */
export function parseAmount(input: string): number | null {
  let s = input.trim().replace(/[\s\u00A0\u202F€']/g, '');
  let negative = false;
  if (s.startsWith('-') || s.startsWith(MINUS)) {
    negative = true;
    s = s.slice(1);
  }
  if (s === '' || !/^[0-9.,]+$/.test(s)) return null;

  const lastSep = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  let intDigits: string;
  let fracDigits = '';
  if (lastSep === -1) {
    intDigits = s;
  } else {
    const sep = s[lastSep];
    const head = s.slice(0, lastSep);
    const tail = s.slice(lastSep + 1);
    const headDigits = head.replace(/[.,]/g, '');
    if (tail.length === 3 && headDigits !== '' && !/^0+$/.test(headDigits)) {
      if (!isThousandsGrouping(s)) return null;
      intDigits = headDigits + tail;
    } else if (tail.length <= 2) {
      if (head.includes(sep)) return null;
      if (/[.,]/.test(head) && !isThousandsGrouping(head)) return null;
      intDigits = headDigits;
      fracDigits = tail;
    } else {
      return null;
    }
  }

  if (intDigits === '') intDigits = '0';
  if (!/^\d+$/.test(intDigits) || (fracDigits !== '' && !/^\d+$/.test(fracDigits))) return null;
  intDigits = intDigits.replace(/^0+(?=\d)/, '');
  if (intDigits.length > 10) return null;

  const cents = Number(intDigits + fracDigits.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents > MAX_AMOUNT_CENTS) return null;
  return negative ? -cents : cents;
}

/** "1.234.567" / "1,234": first group 1–3 digits, the rest exactly 3, a single separator character. */
function isThousandsGrouping(value: string): boolean {
  const seps = new Set(value.replace(/\d/g, ''));
  if (seps.size !== 1) return false;
  const groups = value.split(/[.,]/);
  return groups[0].length >= 1 && groups[0].length <= 3 && groups.slice(1).every((g) => g.length === 3);
}

/** Cents → editable text with a decimal comma: 2450 → "24,50", 1200 → "12". */
export function centsToInput(cents: number): string {
  const abs = Math.abs(cents);
  const int = Math.trunc(abs / 100);
  const frac = abs % 100;
  const body = frac === 0 ? String(int) : `${int},${String(frac).padStart(2, '0')}`;
  return cents < 0 ? `-${body}` : body;
}

/** Groups an integer string with dots every three digits, always (also for 4 digits). */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export interface FormatOptions {
  /** Prefix positive amounts with "+". */
  signed?: boolean;
  /** Drop the decimals (rounded). */
  whole?: boolean;
}

/**
 * Formats cents as euros the Catalan way, with the thousands dot forced: 183157 → "1.831,57 €".
 * (Intl.NumberFormat('ca-ES') leaves 4-digit numbers ungrouped, so we don't rely on it.)
 */
export function formatEUR(cents: number, opts: FormatOptions = {}): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  let body: string;
  if (opts.whole) {
    body = groupThousands(String(Math.round(abs / 100)));
  } else {
    const int = Math.trunc(abs / 100);
    const frac = abs % 100;
    body = `${groupThousands(String(int))},${String(frac).padStart(2, '0')}`;
  }
  const isZero = /^[0.,]+$/.test(body);
  const sign = negative && !isZero ? MINUS : opts.signed && cents > 0 && !isZero ? '+' : '';
  return `${sign}${body}${NBSP}€`;
}

/** Number with a decimal comma and forced grouping: (1234.5, 1) → "1.234,5". */
export function formatDecimal(value: number, decimals = 0): string {
  const negative = value < 0;
  const fixed = Math.abs(value).toFixed(decimals);
  const [int, frac] = fixed.split('.');
  const body = frac ? `${groupThousands(int)},${frac}` : groupThousands(int);
  const isZero = /^[0.,]+$/.test(body);
  return negative && !isZero ? `${MINUS}${body}` : body;
}

/**
 * Compact euros for chart axes and tight spaces: 950 € → "950 €", 1.500 € → "1,5k €",
 * 12.300 € → "12k €", 1.250.000 € → "1,3M €".
 */
export function formatEURCompact(cents: number): string {
  const euros = cents / 100;
  const abs = Math.abs(euros);
  const sign = euros < 0 ? MINUS : '';
  let body: string;
  if (abs >= 1_000_000) body = `${trimDecimal(abs / 1_000_000)}M`;
  else if (abs >= 1_000) body = `${trimDecimal(abs / 1_000)}k`;
  else body = String(Math.round(abs));
  return `${sign}${body}${NBSP}€`;
}

/** One decimal under 10 (1,5k), none above (12k). */
function trimDecimal(value: number): string {
  if (value >= 10) return String(Math.round(value));
  const rounded = Math.round(value * 10) / 10;
  return rounded % 1 === 0 ? String(rounded) : String(rounded).replace('.', ',');
}

/** Percentage with a comma: 12.345 → "12,3 %". */
export function formatPercent(value: number, decimals = 1, opts: { signed?: boolean } = {}): string {
  const rounded = Number(value.toFixed(decimals));
  const body = formatDecimal(rounded, Number.isInteger(rounded) ? 0 : decimals);
  const sign = opts.signed && rounded > 0 ? '+' : '';
  return `${sign}${body}${NBSP}%`;
}

/** Share of part in total as a percentage (0 when the total is 0). */
export function percentOf(part: number, total: number): number {
  if (total === 0) return 0;
  return (part / total) * 100;
}

export function sum(values: Iterable<number>): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}
