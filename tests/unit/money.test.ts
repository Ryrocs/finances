import { describe, expect, it } from 'vitest';
import { centsToInput, formatDecimal, formatEUR, formatEURCompact, formatPercent, parseAmount } from '../../src/lib/money';

const NBSP = String.fromCharCode(0xa0);
const MINUS = String.fromCharCode(0x2212);
/** Test helper: write expectations with normal spaces and "-". */
const n = (s: string) => s.replace(/ /g, NBSP).replace(/-/g, MINUS);

describe('formatEUR', () => {
  it('always groups thousands with a dot, also with 4 digits', () => {
    expect(formatEUR(183157)).toBe(n('1.831,57 €'));
    expect(formatEUR(100000)).toBe(n('1.000,00 €'));
    expect(formatEUR(123456789)).toBe(n('1.234.567,89 €'));
    expect(formatEUR(99999)).toBe(n('999,99 €'));
  });

  it('formats small amounts and zero', () => {
    expect(formatEUR(0)).toBe(n('0,00 €'));
    expect(formatEUR(5)).toBe(n('0,05 €'));
    expect(formatEUR(2450)).toBe(n('24,50 €'));
  });

  it('uses a real minus sign and an optional plus', () => {
    expect(formatEUR(-183157)).toBe(n('-1.831,57 €'));
    expect(formatEUR(2450, { signed: true })).toBe(n('+24,50 €'));
    expect(formatEUR(0, { signed: true })).toBe(n('0,00 €'));
  });

  it('can drop decimals', () => {
    expect(formatEUR(183157, { whole: true })).toBe(n('1.832 €'));
  });

  it('never lets the € wrap onto its own line', () => {
    expect(formatEUR(183157)).toContain(NBSP + '€');
    expect(formatEUR(183157)).not.toContain(' ');
  });
});

describe('formatEURCompact', () => {
  it('abbreviates thousands and millions', () => {
    expect(formatEURCompact(95000)).toBe(n('950 €'));
    expect(formatEURCompact(150000)).toBe(n('1,5k €'));
    expect(formatEURCompact(1230000)).toBe(n('12k €'));
    expect(formatEURCompact(125000000)).toBe(n('1,3M €'));
    expect(formatEURCompact(-150000)).toBe(n('-1,5k €'));
    expect(formatEURCompact(200000)).toBe(n('2k €'));
  });
});

describe('formatDecimal / formatPercent', () => {
  it('uses a decimal comma', () => {
    expect(formatDecimal(1234.5, 1)).toBe('1.234,5');
    expect(formatPercent(12.345)).toBe(n('12,3 %'));
    expect(formatPercent(50)).toBe(n('50 %'));
    expect(formatPercent(-4.25, 1)).toBe(n('-4,3 %'));
    expect(formatPercent(7.5, 1, { signed: true })).toBe(n('+7,5 %'));
  });
});

describe('parseAmount', () => {
  it('accepts a decimal comma or point', () => {
    expect(parseAmount('24,50')).toBe(2450);
    expect(parseAmount('24,5')).toBe(2450);
    expect(parseAmount('24.5')).toBe(2450);
    expect(parseAmount('24')).toBe(2400);
    expect(parseAmount(',5')).toBe(50);
    expect(parseAmount('0,01')).toBe(1);
  });

  it('understands thousands separators', () => {
    expect(parseAmount('1.234,56')).toBe(123456);
    expect(parseAmount('1.234')).toBe(123400);
    expect(parseAmount('1,234.56')).toBe(123456);
    expect(parseAmount('1 234,56')).toBe(123456);
    expect(parseAmount('€ 12')).toBe(1200);
  });

  it('never goes through floats', () => {
    expect(parseAmount('0,1')).toBe(10);
    expect(parseAmount('0,2')).toBe(20);
    expect(parseAmount('19,99')).toBe(1999);
    expect(parseAmount('1,005')).toBe(100500);
  });

  it('rejects invalid input', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('1,2,3')).toBeNull();
    expect(parseAmount('12,345,6')).toBeNull();
    expect(parseAmount('1.2345')).toBeNull();
  });

  it('keeps the sign so the form can reject negatives', () => {
    expect(parseAmount('-5')).toBe(-500);
  });
});

describe('centsToInput', () => {
  it('round-trips with parseAmount', () => {
    for (const cents of [0, 1, 50, 2450, 183157, 100000]) expect(parseAmount(centsToInput(cents))).toBe(cents);
    expect(centsToInput(2450)).toBe('24,50');
    expect(centsToInput(1200)).toBe('12');
  });
});
