'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { LOCALE_COOKIE } from '@/lib/i18n/config';
import { loadMessages } from '@/lib/i18n/load';
import type { Messages } from '@/lib/i18n/messages/en';
import { createTranslator, type Translator } from '@/lib/i18n/translate';
import type { Locale } from '@/lib/types';

interface I18nContextValue extends Translator {
  setLocale: (locale: Locale) => Promise<void>;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ locale: initialLocale, messages: initialMessages, children }: { locale: Locale; messages: Messages; children: ReactNode }) {
  const [state, setState] = useState({ locale: initialLocale, messages: initialMessages });

  const setLocale = useCallback(async (locale: Locale) => {
    const messages = await loadMessages(locale);
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 400}; samesite=lax`;
    document.documentElement.lang = locale;
    setState({ locale, messages });
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({ ...createTranslator(state.locale, state.messages), setLocale }),
    [state, setLocale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
