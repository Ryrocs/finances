import 'server-only';
import { cookies } from 'next/headers';
import { LOCALES, type Locale } from '@/lib/types';
import { LOCALE_COOKIE } from '@/lib/i18n/config';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Language for server rendering: cookie (set by the switcher / at login) → Catalan default. */
export async function getRequestLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : 'ca';
}

export async function setLocaleCookie(locale: Locale): Promise<void> {
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 400,
  });
}
