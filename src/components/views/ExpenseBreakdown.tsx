'use client';

import { useState } from 'react';
import { DonutChart, type DonutSegment } from '@/components/charts/DonutChart';
import { useI18n } from '@/components/providers/I18nProvider';
import { Card, CardHeader } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';
import { CategoryBadge } from '@/components/ui/icons';
import { useFormat, useLookups } from '@/hooks/useFormat';
import { percentOf } from '@/lib/money';
import type { CategoryAmount, MonthSummaryDTO } from '@/lib/types';

const MAX_SEGMENTS = 6;
const REST_COLOR = '#c3c2b7';

/** Donut segments: top categories + "Other categories" so the chart never cycles colours. */
export function toSegments(items: CategoryAmount[], label: (id: string) => string, color: (id: string) => string, restLabel: string): DonutSegment[] {
  const top = items.slice(0, MAX_SEGMENTS);
  const rest = items.slice(MAX_SEGMENTS).reduce((s, c) => s + c.amountCents, 0);
  const segments = top.map((c) => ({ id: c.categoryId, label: label(c.categoryId), value: c.amountCents, color: color(c.categoryId) }));
  if (rest > 0) segments.push({ id: '__rest', label: restLabel, value: rest, color: REST_COLOR });
  return segments;
}

export function ExpenseBreakdown({ summary }: { summary: MonthSummaryDTO }) {
  const { t } = useI18n();
  const f = useFormat();
  const { category, categoryLabelById } = useLookups();
  const [active, setActive] = useState<string | null>(null);
  const items = summary.expensesByCategory;
  const total = summary.expenseCents;
  const segments = toSegments(items, categoryLabelById, (id) => category(id)?.color ?? REST_COLOR, t('categories.rest'));
  const groups = (['needs', 'lifestyle', 'other'] as const).filter((g) => summary.groupTotals[g] > 0);

  return (
    <Card>
      <CardHeader title={t('dashboard.expenseBreakdown')} subtitle={f.month(summary.month)} />
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-3">{t('dashboard.noExpenses')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
          <DonutChart
            segments={segments}
            centerTitle={t('dashboard.expenses')}
            centerValue={f.money(total, { whole: total >= 100_000 })}
            formatValue={(v) => f.money(v)}
            activeId={active}
            onActiveChange={setActive}
            tableCaption={t('dashboard.expenseBreakdown')}
          />
          <div className="min-w-0">
            {groups.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {groups.map((g) => (
                  <span key={g} className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-ink-2">
                    {t(`groups.${g}`)} · <span className="tabular">{f.percent(percentOf(summary.groupTotals[g], total))}</span>
                  </span>
                ))}
              </div>
            )}
            <ul className="-mx-2">
              {items.map((c) => {
                const cat = category(c.categoryId);
                const pct = percentOf(c.amountCents, total);
                const inChart = segments.some((s) => s.id === c.categoryId);
                const isActive = active === c.categoryId || (active === '__rest' && !inChart);
                return (
                  <li key={c.categoryId}>
                    <button
                      type="button"
                      onClick={() => setActive(inChart ? (active === c.categoryId ? null : c.categoryId) : active === '__rest' ? null : '__rest')}
                      className={cn('flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors', isActive ? 'bg-surface-2' : 'hover:bg-surface-2/60')}
                      aria-pressed={isActive}
                    >
                      <CategoryBadge category={cat} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[14px] font-medium text-ink">{categoryLabelById(c.categoryId)}</span>
                          <span className="shrink-0 text-[14px] font-semibold text-ink tabular">{f.money(c.amountCents)}</span>
                        </span>
                        <span className="mt-1 flex items-center gap-2">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                            <span className="block h-full rounded-full" style={{ width: `${Math.max(2, pct)}%`, background: cat?.color ?? REST_COLOR }} />
                          </span>
                          <span className="w-12 shrink-0 text-right text-[12px] text-ink-3 tabular">{f.percent(pct, { digits: 1 })}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}
