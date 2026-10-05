import type { Locale } from '../types';
import { INTL_LOCALE } from './config';
import type { Messages } from './messages/en';

type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
/** An object whose keys are all plural categories (and includes `other`). */
type IsPlural<T> = T extends { other: string } ? (Exclude<keyof T, PluralCategory> extends never ? true : false) : false;

/** Dot-paths to string leaves, e.g. "dashboard.income". */
export type MessageKey = {
  [K in keyof Messages & string]: Leaves<Messages[K], K>;
}[keyof Messages & string];

type Leaves<T, P extends string> = T extends string
  ? P
  : IsPlural<T> extends true
    ? never
    : { [K in keyof T & string]: Leaves<T[K], `${P}.${K}`> }[keyof T & string];

/** Dot-paths to plural entries ({ one, other, … }). */
export type PluralKey = {
  [K in keyof Messages & string]: PluralLeaves<Messages[K], K>;
}[keyof Messages & string];

type PluralLeaves<T, P extends string> = T extends string
  ? never
  : IsPlural<T> extends true
    ? P
    : { [K in keyof T & string]: PluralLeaves<T[K], `${P}.${K}`> }[keyof T & string];

export type Vars = Record<string, string | number>;

function lookup(messages: Messages, key: string): unknown {
  let node: unknown = messages;
  for (const part of key.split('.')) {
    if (node && typeof node === 'object' && part in node) node = (node as Record<string, unknown>)[part];
    else return undefined;
  }
  return node;
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export interface Translator {
  locale: Locale;
  intlLocale: string;
  t: (key: MessageKey, vars?: Vars) => string;
  /** Plural-aware lookup; `count` is also available as {count}. A `zero` form wins for 0. */
  tp: (key: PluralKey, count: number, vars?: Vars) => string;
  /** Lookup by a dynamic key (e.g. built-in category keys); returns fallback if missing. */
  tDynamic: (key: string, fallback?: string) => string;
}

export function createTranslator(locale: Locale, messages: Messages): Translator {
  const intlLocale = INTL_LOCALE[locale];
  const plural = new Intl.PluralRules(intlLocale);
  return {
    locale,
    intlLocale,
    t(key, vars) {
      const value = lookup(messages, key);
      return typeof value === 'string' ? interpolate(value, vars) : key;
    },
    tp(key, count, vars) {
      const forms = lookup(messages, key) as Record<string, string> | undefined;
      if (!forms || typeof forms !== 'object') return key;
      const form = (count === 0 && forms.zero) || forms[plural.select(count)] || forms.other;
      return interpolate(form, { count, ...vars });
    },
    tDynamic(key, fallback) {
      const value = lookup(messages, key);
      return typeof value === 'string' ? value : (fallback ?? key);
    },
  };
}
