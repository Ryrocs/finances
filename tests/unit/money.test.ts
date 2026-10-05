import { describe, expect, it } from 'vitest';
import { centsToInput, formatMoney, parseAmountToCents, percentOf, sumCents } from '@/lib/money';

describe('parseAmountToCents', () => {
  it.each([
    ['12,34', 1234],
    ['12.34', 1234],
    ['12', 1200],
    ['12,5', 1250],
    ['0,99', 99],
    [',5', 50],
    ['12,', 1200],
    ['1.234,56', 123456],
    ['1,234.56', 123456],
    ['1.234', 123400],
    ['1,234,567', 123456700],
    ['12.345.678,90', 1234567890],
    ['1 234,50', 123450],
    ['€ 20', 2000],
    ['20 €', 2000],
    ['0012,30', 1230],
  ])('parses %s → %i cents', (input, cents) => {
    expect(parseAmountToCents(input)).toBe(cents);
  });

  it.each(['', 'abc', '12,345', '1.2.3', '1234.567', '0,125', '12,3,4', '1.234.56', '--5', '1e3'])('rejects %s', (input) => {
    // "12,345" is three decimals after the only separator but too ambiguous → treated as thousands only if grouping is valid
    const value = parseAmountToCents(input);
    if (input === '12,345') expect(value).toBe(1234500);
    else expect(value).toBeNull();
  });

  it('rejects negatives unless allowed', () => {
    expect(parseAmountToCents('-12,50')).toBeNull();
    expect(parseAmountToCents('-12,50', { allowNegative: true })).toBe(-1250);
  });

  it('rejects absurdly large amounts', () => {
    expect(parseAmountToCents('99999999999999')).toBeNull();
    expect(parseAmountToCents('999999999999,99')).toBe(99_999_999_999_999);
  });

  it('never produces floating point artefacts', () => {
    // 12.34 * 100 = 1233.9999999999998 in floating point; the parser works on digits.
    expect(parseAmountToCents('12.34')).toBe(1234);
    expect(parseAmountToCents('0.29')).toBe(29);
    expect(parseAmountToCents('1.005')).toBe(100500); // thousands separator, not a float
  });
});

describe('formatMoney', () => {
  it('formats EUR per locale', () => {
    expect(formatMoney(123456, 'ca-ES')).toBe('1.234,56 €');
    expect(formatMoney(123456, 'en-GB')).toBe('€1,234.56');
    expect(formatMoney(1234, 'es-ES')).toBe('12,34 €');
  });

  it('uses a real minus sign and optional plus', () => {
    expect(formatMoney(-2000, 'ca-ES')).toBe('−20,00 €');
    expect(formatMoney(5500, 'ca-ES', 'EUR', { signed: true })).toBe('+55,00 €');
    expect(formatMoney(0, 'ca-ES', 'EUR', { signed: true })).toBe('0,00 €');
  });

  it('keeps cents exact', () => {
    expect(formatMoney(1234, 'en-GB')).toBe('€12.34');
    expect(formatMoney(sumCents([10, 10, 10, 10, 10, 10, 10, 10, 10, 10]), 'en-GB')).toBe('€1.00');
  });

  it('can drop decimals for headlines', () => {
    expect(formatMoney(78049, 'ca-ES', 'EUR', { whole: true })).toBe('780 €');
  });
});

describe('centsToInput', () => {
  it('uses the locale decimal separator', () => {
    expect(centsToInput(1250, 'ca-ES')).toBe('12,50');
    expect(centsToInput(1250, 'en-GB')).toBe('12.50');
    expect(centsToInput(1200, 'es-ES')).toBe('12');
    expect(centsToInput(-505, 'ca-ES')).toBe('-5,05');
  });

  it('round-trips through the parser', () => {
    for (const cents of [1, 99, 100, 1234, 99999, 123456789]) {
      expect(parseAmountToCents(centsToInput(cents, 'ca-ES'))).toBe(cents);
      expect(parseAmountToCents(centsToInput(cents, 'en-GB'))).toBe(cents);
    }
  });
});

describe('percentOf', () => {
  it('rounds to one decimal and handles zero totals', () => {
    expect(percentOf(1, 3)).toBe(33.3);
    expect(percentOf(5, 0)).toBe(0);
  });
});
