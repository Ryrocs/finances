'use client';

import { Calendar } from 'lucide-react';
import { useId } from 'react';
import { useI18n } from '@/components/providers/I18nProvider';
import { cn } from '@/components/ui/cn';
import { CategoryBadge, IconBadge, accountIcon } from '@/components/ui/icons';
import { useFormat, useLookups } from '@/hooks/useFormat';
import { addDays } from '@/lib/dates';
import type { AccountDTO, CategoryDTO } from '@/lib/types';

/** Category tiles (radio group): big targets, no typing. */
export function CategoryPicker({
  categories,
  value,
  onChange,
  label,
  invalid,
}: {
  categories: CategoryDTO[];
  value: string | null;
  onChange: (id: string) => void;
  label: string;
  invalid?: boolean;
}) {
  const name = useId();
  const { categoryLabel } = useLookups();
  return (
    <fieldset>
      <legend className="mb-2 px-1 text-sm font-medium text-ink-2">{label}</legend>
      <div
        role="radiogroup"
        aria-label={label}
        aria-invalid={invalid || undefined}
        className={cn('grid grid-cols-3 gap-2 min-[420px]:grid-cols-4', invalid && 'rounded-2xl ring-2 ring-danger/60 ring-offset-2')}
      >
        {categories.map((c) => {
          const checked = value === c.id;
          return (
            <label
              key={c.id}
              className={cn(
                'flex min-h-[78px] cursor-pointer flex-col items-center justify-start gap-1.5 rounded-2xl border px-1 pb-2 pt-2.5 text-center transition-colors',
                checked ? 'border-brand bg-brand-soft' : 'border-transparent bg-surface-2 hover:bg-surface-3',
              )}
            >
              <input type="radio" name={name} value={c.id} checked={checked} onChange={() => onChange(c.id)} className="sr-only" />
              <CategoryBadge category={c} size="sm" />
              <span className={cn('line-clamp-2 w-full text-[12px] leading-tight hyphens-auto', checked ? 'font-semibold text-brand-ink' : 'text-ink-2')}>
                {categoryLabel(c)}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Account chips (radio group) with current balance. */
export function AccountPicker({
  accounts,
  value,
  onChange,
  label,
  invalid,
  exclude,
}: {
  accounts: AccountDTO[];
  value: string | null;
  onChange: (id: string) => void;
  label: string;
  invalid?: boolean;
  exclude?: string | null;
}) {
  const name = useId();
  const f = useFormat();
  const { t } = useI18n();
  return (
    <fieldset>
      <legend className="mb-2 px-1 text-sm font-medium text-ink-2">{label}</legend>
      <div role="radiogroup" aria-label={label} className={cn('flex flex-wrap gap-2', invalid && 'rounded-2xl ring-2 ring-danger/60 ring-offset-2')}>
        {accounts
          .filter((a) => a.id !== exclude)
          .map((a) => {
            const checked = value === a.id;
            return (
              <label
                key={a.id}
                className={cn(
                  'flex min-h-12 max-w-full cursor-pointer items-center gap-2 rounded-2xl border py-1.5 pl-1.5 pr-3 transition-colors',
                  checked ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:bg-surface-2',
                )}
              >
                <input type="radio" name={name} value={a.id} checked={checked} onChange={() => onChange(a.id)} className="sr-only" />
                <IconBadge icon={accountIcon(a.type)} color={a.color} size="sm" />
                <span className="min-w-0">
                  <span className={cn('block truncate text-[14px] leading-tight', checked ? 'font-semibold text-brand-ink' : 'font-medium text-ink')}>
                    {a.archived ? t('form.archivedAccount', { name: a.name }) : a.name}
                  </span>
                  <span className="block text-[12px] leading-tight text-ink-3 tabular">{f.money(a.balanceCents)}</span>
                </span>
              </label>
            );
          })}
      </div>
    </fieldset>
  );
}

/** Today / Yesterday / any date (native picker). */
export function DatePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const { t } = useI18n();
  const f = useFormat();
  const yesterday = addDays(f.today, -1);
  const isOther = value !== f.today && value !== yesterday;
  const id = useId();
  const chip = (active: boolean) =>
    cn(
      'flex h-11 items-center justify-center rounded-2xl border px-4 text-[14px] font-semibold transition-colors',
      active ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
    );
  return (
    <fieldset>
      <legend className="mb-2 px-1 text-sm font-medium text-ink-2">{label}</legend>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={chip(value === f.today)} aria-pressed={value === f.today} onClick={() => onChange(f.today)}>
          {t('common.today')}
        </button>
        <button type="button" className={chip(value === yesterday)} aria-pressed={value === yesterday} onClick={() => onChange(yesterday)}>
          {t('common.yesterday')}
        </button>
        <label htmlFor={id} className={cn(chip(isOther), 'relative min-w-0 flex-1 gap-2 overflow-hidden')}>
          <Calendar className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{isOther ? f.date(value, 'medium') : t('form.otherDate')}</span>
          <input
            id={id}
            type="date"
            value={value}
            onChange={(e) => e.target.value && onChange(e.target.value)}
            onClick={(e) => {
              try {
                e.currentTarget.showPicker?.();
              } catch {
                // showPicker can throw if not triggered by a user gesture; native behaviour remains.
              }
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={label}
          />
        </label>
      </div>
    </fieldset>
  );
}
