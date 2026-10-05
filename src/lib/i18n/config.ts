import type { Locale } from '../types';

export const DEFAULT_LOCALE: Locale = 'ca';
export const LOCALE_COOKIE = 'fin_locale';

/** BCP 47 tags used for Intl number/date formatting. */
export const INTL_LOCALE: Record<Locale, string> = {
  ca: 'ca-ES',
  es: 'es-ES',
  en: 'en-GB',
};

/** Language names are always shown in their own language. Flags are inline SVGs (see Flag.tsx). */
export const LOCALE_LABELS: Record<Locale, { code: string; name: string }> = {
  ca: { code: 'CA', name: 'Català' },
  es: { code: 'ES', name: 'Español' },
  en: { code: 'EN', name: 'English' },
};
