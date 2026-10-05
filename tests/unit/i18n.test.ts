import { describe, expect, it } from 'vitest';
import ca from '@/lib/i18n/messages/ca';
import en from '@/lib/i18n/messages/en';
import es from '@/lib/i18n/messages/es';
import { createTranslator } from '@/lib/i18n/translate';
import { DEFAULT_CATEGORIES } from '@/lib/categories';
import { formatMonth, formatPercent } from '@/lib/format';

function leaves(obj: unknown, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.set(key, v);
    else for (const [kk, vv] of leaves(v, key)) out.set(kk, vv);
  }
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('translations', () => {
  const source = leaves(en);

  it.each([
    ['ca', ca],
    ['es', es],
  ])('%s has exactly the same keys as en, none empty, same placeholders', (_name, dict) => {
    const other = leaves(dict);
    expect([...other.keys()].sort()).toEqual([...source.keys()].sort());
    for (const [key, value] of other) {
      expect(value.trim(), key).not.toBe('');
      expect(placeholders(value), key).toEqual(placeholders(source.get(key)!));
    }
  });

  it('translates every built-in category', () => {
    for (const dict of [ca, es, en]) {
      for (const c of DEFAULT_CATEGORIES) expect((dict.categories as Record<string, string>)[c.key]).toBeTruthy();
    }
  });

  it('interpolates and pluralises', () => {
    const t = createTranslator('ca', ca);
    expect(t.t('dashboard.greeting', { name: 'Anna' })).toBe('Hola, Anna');
    expect(t.tp('movements.count', 1)).toBe('1 moviment');
    expect(t.tp('movements.count', 3)).toBe('3 moviments');
    expect(t.tp('accounts.deleteConfirmText', 0)).toBe(ca.accounts.deleteConfirmText.zero);
    const tEn = createTranslator('en', en);
    expect(tEn.tp('analytics.months', 6)).toBe('6 months');
    expect(tEn.tDynamic('categories.housing')).toBe('Housing');
    expect(tEn.tDynamic('categories.nope', 'fallback')).toBe('fallback');
  });

  it('formats dates and percentages per language', () => {
    expect(formatMonth('2026-10', 'ca-ES', 'long')).toBe('Octubre');
    expect(formatMonth('2026-10', 'es-ES')).toBe('Octubre de 2026');
    expect(formatMonth('2026-10', 'en-GB')).toBe('October 2026');
    expect(formatPercent(13.1, 'en-GB', { signed: true })).toBe('+13%');
    expect(formatPercent(13.1, 'ca-ES', { signed: true })).toBe('+13 %');
  });
});
