'use client';

import { Check } from 'lucide-react';
import { useI18n } from '@/components/providers/I18nProvider';
import { cn } from '@/components/ui/cn';
import { Flag } from '@/components/ui/Flag';
import { LOCALE_LABELS } from '@/lib/i18n/config';
import { LOCALES, type Locale } from '@/lib/types';

/** Language list (Settings) — `onChange` persists the choice. */
export function LanguageList({ onChange, disabled }: { onChange: (l: Locale) => void; disabled?: boolean }) {
  const { locale, t } = useI18n();
  return (
    <div role="radiogroup" aria-label={t('settings.language')} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {LOCALES.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => !active && onChange(l)}
            lang={l}
            className={cn(
              'flex h-14 items-center gap-3 rounded-2xl border px-4 text-left text-[15px] font-medium transition-colors',
              active ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line bg-surface text-ink hover:bg-surface-2',
            )}
          >
            <Flag locale={l} className="h-5 w-7 shrink-0 overflow-hidden rounded-[3px] shadow-sm" />
            <span className="flex-1">{LOCALE_LABELS[l].name}</span>
            {active && <Check className="h-5 w-5" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

/** Compact switcher for the login/sign-up screens (no account yet → cookie only). */
export function LanguagePills() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div role="radiogroup" aria-label={t('settings.language')} className="flex gap-1 rounded-full border border-line bg-surface p-1 shadow-card">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={l === locale}
          lang={l}
          onClick={() => void setLocale(l)}
          className={cn('flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold', l === locale ? 'bg-ink text-white' : 'text-ink-2 hover:bg-surface-2')}
        >
          <Flag locale={l} className="h-3.5 w-5 overflow-hidden rounded-[2px]" />
          {LOCALE_LABELS[l].code}
          <span className="sr-only">{LOCALE_LABELS[l].name}</span>
        </button>
      ))}
    </div>
  );
}
