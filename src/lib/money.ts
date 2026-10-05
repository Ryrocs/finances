/**
 * Money helpers. All amounts are integer cents (number). Floats are never used for money:
 * user input is parsed digit-by-digit and formatting divides only for display.
 */

/** 999,999,999,999.99 — far above any personal balance, far below Number.MAX_SAFE_INTEGER. */
export const MAX_AMOUNT_CENTS = 99_999_999_999_999;

/**
 * Parses what a person types into cents, accepting both decimal separators:
 * "12,34" "12.34" "1.234,56" "1,234.56" "1 234,5" "€ 12" → 1234, 1234, 123456, 123456, 123450, 1200.
 * A separator followed by exactly 3 digits is a thousands separator ("1.234" → 123400),
 * because EUR has 2 decimals. Returns null for anything that isn't a valid amount.
 */
export function parseAmountToCents(input: string, { allowNegative = false } = {}): number | null {
  let s = input.trim().replace(/[\s  €$£']/g, '');
  let negative = false;
  if (s.startsWith('-') || s.startsWith('−')) {
    if (!allowNegative) return null;
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
      // Thousands separator: "1.234" → 1234, "1,234,567" → 1234567.
      if (!isThousandsGrouping(s)) return null;
      intDigits = headDigits + tail;
    } else if (tail.length <= 2) {
      // Decimal separator. The integer part may use the *other* character for thousands.
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
  if (intDigits.length > 12) return null;

  const cents = Number(intDigits + fracDigits.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents > MAX_AMOUNT_CENTS) return null;
  return negative ? -cents : cents;
}

/** "1.234.567" / "1,234": first group 1–3 digits, the rest exactly 3, one separator character. */
function isThousandsGrouping(value: string): boolean {
  const seps = new Set(value.replace(/\d/g, ''));
  if (seps.size !== 1) return false;
  const groups = value.split(/[.,]/);
  return groups[0].length >= 1 && groups[0].length <= 3 && groups.slice(1).every((g) => g.length === 3);
}

/** Cents → editable string using the locale's decimal separator ("12,34" in ca/es). */
export function centsToInput(cents: number, locale: string): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const int = Math.trunc(abs / 100);
  const frac = abs % 100;
  const sep = decimalSeparator(locale);
  const body = frac === 0 ? String(int) : `${int}${sep}${String(frac).padStart(2, '0')}`;
  return negative ? `-${body}` : body;
}

export function decimalSeparator(locale: string): string {
  const part = new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === 'decimal');
  return part?.value ?? ',';
}

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(locale: string, currency: string, variant: 'full' | 'whole' | 'compact'): Intl.NumberFormat {
  const key = `${locale}|${currency}|${variant}`;
  let f = formatterCache.get(key);
  if (!f) {
    const options: Intl.NumberFormatOptions = { style: 'currency', currency };
    if (variant === 'whole') {
      options.minimumFractionDigits = 0;
      options.maximumFractionDigits = 0;
    } else if (variant === 'compact') {
      options.notation = 'compact';
      options.maximumFractionDigits = 1;
    }
    f = new Intl.NumberFormat(locale, options);
    formatterCache.set(key, f);
  }
  return f;
}

export interface FormatMoneyOptions {
  /** Show + for positive amounts (e.g. differences). */
  signed?: boolean;
  /** Drop decimals (chart axes, very large headline numbers). */
  whole?: boolean;
  compact?: boolean;
}

/**
 * Formats cents as currency. Division by 100 happens here only, on an exact integer,
 * so 1234 always renders as 12,34 € and never 12,339999.
 */
export function formatMoney(cents: number, locale: string, currency = 'EUR', opts: FormatMoneyOptions = {}): string {
  const variant = opts.compact ? 'compact' : opts.whole ? 'whole' : 'full';
  const value = variant === 'whole' ? Math.round(cents / 100) : cents / 100;
  const formatted = getFormatter(locale, currency, variant).format(Math.abs(value));
  if (cents < 0 && value !== 0) return `−${formatted}`;
  if (opts.signed && cents > 0) return `+${formatted}`;
  return formatted;
}

/** Percentage helper on integers: share of `part` in `total`, rounded to 0.1. */
export function percentOf(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export function sumCents(values: Iterable<number>): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}
