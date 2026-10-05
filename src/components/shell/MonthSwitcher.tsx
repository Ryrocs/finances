'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '@/components/providers/I18nProvider';
import { cn } from '@/components/ui/cn';
import { useFormat } from '@/hooks/useFormat';
import { addMonthsToKey, monthOf } from '@/lib/dates';
import { useMonth } from './MonthContext';

/** ‹ October 2026 › — month navigation with large touch targets. */
export function MonthSwitcher({ className, allowFuture = false }: { className?: string; allowFuture?: boolean }) {
  const { month, setMonth } = useMonth();
  const { t } = useI18n();
  const f = useFormat();
  const current = monthOf(f.today);
  const isCurrent = month === current;
  const canGoNext = allowFuture || month < current;

  return (
    <div className={cn('flex items-center gap-1 rounded-2xl border border-line bg-surface p-1 shadow-card', className)}>
      <button
        type="button"
        onClick={() => setMonth(addMonthsToKey(month, -1))}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-2 hover:bg-surface-2"
        aria-label={t('common.previousMonth')}
      >
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => setMonth(current)}
        disabled={isCurrent}
        className="min-w-0 flex-1 truncate px-1 text-center text-[15px] font-semibold text-ink disabled:cursor-default"
        aria-label={isCurrent ? f.month(month) : `${f.month(month)} — ${t('common.currentMonth')}`}
        aria-live="polite"
      >
        {f.month(month)}
      </button>
      <button
        type="button"
        onClick={() => setMonth(addMonthsToKey(month, 1))}
        disabled={!canGoNext}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-2 hover:bg-surface-2 disabled:opacity-30"
        aria-label={t('common.nextMonth')}
      >
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}
