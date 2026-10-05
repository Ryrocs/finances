'use client';

import { forwardRef, useMemo } from 'react';
import { useI18n } from '@/components/providers/I18nProvider';
import { cn } from '@/components/ui/cn';
import { useFormat } from '@/hooks/useFormat';
import { decimalSeparator } from '@/lib/money';

function currencyParts(locale: string, currency: string) {
  const parts = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(1);
  const symbol = parts.find((p) => p.type === 'currency')?.value ?? '€';
  const symbolFirst = parts.findIndex((p) => p.type === 'currency') < parts.findIndex((p) => p.type === 'integer');
  return { symbol, symbolFirst };
}

/** Large amount field with the decimal keypad on phones. Value is the raw typed string. */
export const AmountInput = forwardRef<
  HTMLInputElement,
  {
    id?: string;
    value: string;
    onChange: (v: string) => void;
    size?: 'xl' | 'md';
    tone?: 'expense' | 'income' | 'transfer' | 'neutral';
    allowNegative?: boolean;
    autoFocus?: boolean;
    invalid?: boolean;
    describedBy?: string;
    label: string;
  }
>(function AmountInput({ id, value, onChange, size = 'xl', tone = 'neutral', allowNegative, autoFocus, invalid, describedBy, label }, ref) {
  const { intlLocale } = useI18n();
  const { currency } = useFormat();
  const { symbol, symbolFirst } = useMemo(() => currencyParts(intlLocale, currency), [intlLocale, currency]);
  const placeholder = `0${decimalSeparator(intlLocale)}00`;
  const toneClass = { expense: 'text-expense', income: 'text-income', transfer: 'text-transfer', neutral: 'text-ink' }[tone];

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-3xl border bg-surface-2 px-4 transition-colors focus-within:border-brand focus-within:bg-surface',
        invalid ? 'border-danger bg-danger-soft/40' : 'border-transparent',
        size === 'xl' ? 'h-20' : 'h-14',
      )}
    >
      {symbolFirst && <span className={cn('font-semibold text-ink-3', size === 'xl' ? 'text-3xl' : 'text-xl')}>{symbol}</span>}
      <input
        ref={ref}
        id={id}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        type="text"
        inputMode="decimal"
        enterKeyHint="done"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          const next = e.target.value.replace(allowNegative ? /[^0-9.,\-−]/g : /[^0-9.,]/g, '');
          onChange(next.slice(0, 18));
        }}
        className={cn(
          'w-full min-w-0 bg-transparent text-center font-bold tracking-tight outline-none placeholder:text-ink-4/70 tabular',
          size === 'xl' ? 'text-[40px] leading-none' : 'text-2xl',
          value ? toneClass : '',
        )}
        style={{ fontSize: size === 'xl' ? 40 : 24 }}
      />
      {!symbolFirst && <span className={cn('font-semibold text-ink-3', size === 'xl' ? 'text-3xl' : 'text-xl')}>{symbol}</span>}
    </div>
  );
});
