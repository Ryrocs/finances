'use client';

import { ArrowDown, ArrowUp, ChartPie, Minus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BarChart, ChartLegend, type BarGroup } from '@/components/charts/BarChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { useI18n } from '@/components/providers/I18nProvider';
import { PageHeader } from '@/components/shell/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';
import { Field, Select } from '@/components/ui/Field';
import { CategoryBadge } from '@/components/ui/icons';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/States';
import { useAnalytics } from '@/hooks/api';
import { useFormat, useLookups } from '@/hooks/useFormat';
import { addMonthsToKey, monthOf } from '@/lib/dates';
import { compareAmounts, compareCategories } from '@/lib/finance/cashflow';
import { percentOf } from '@/lib/money';
import type { AnalyticsDTO, CategoryAmount } from '@/lib/types';
import { toSegments } from './ExpenseBreakdown';

type Range = '3' | '6' | '12';
const INCOME_COLOR = 'var(--color-income-mark)';
const EXPENSE_COLOR = 'var(--color-expense-mark)';

export function AnalyticsView() {
  const { t, tp } = useI18n();
  const f = useFormat();
  const [range, setRange] = useState<Range>('6');
  const current = monthOf(f.today);
  const from = addMonthsToKey(current, -(Number(range) - 1));
  const query = useAnalytics(from, current);

  return (
    <>
      <PageHeader title={t('analytics.title')} />
      <div className="space-y-4">
        <Segmented<Range>
          label={t('analytics.title')}
          value={range}
          onChange={setRange}
          className="lg:max-w-md"
          options={(['3', '6', '12'] as const).map((n) => ({ value: n, label: tp('analytics.months', Number(n)) }))}
        />
        {query.isPending ? (
          <PageSkeleton />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : query.data.series.every((s) => s.incomeCents === 0 && s.expenseCents === 0) ? (
          <Card>
            <EmptyState icon={ChartPie} title={t('analytics.noData')} />
          </Card>
        ) : (
          <AnalyticsContent data={query.data} />
        )}
      </div>
    </>
  );
}

function AnalyticsContent({ data }: { data: AnalyticsDTO }) {
  const { t } = useI18n();
  const f = useFormat();
  const tick = (v: number) => f.money(v, { compact: Math.abs(v) >= 1_000_00, whole: true });
  const groups = (key: 'income' | 'expense' | 'balance'): BarGroup[] =>
    data.series.map((s) => ({
      key: s.month,
      label: f.month(s.month, 'short'),
      fullLabel: f.month(s.month),
      values: (key === 'income'
        ? { income: s.incomeCents, expense: s.expenseCents }
        : key === 'expense'
          ? { expense: s.expenseCents }
          : { balance: s.balanceCents }) as Record<string, number>,
    }));
  const totals = data.series.reduce((acc, s) => ({ income: acc.income + s.incomeCents, expense: acc.expense + s.expenseCents }), { income: 0, expense: 0 });
  const net = totals.income - totals.expense;
  const withData = data.series.filter((s) => s.expenseCents > 0);
  const avgExpense = withData.length ? Math.round(withData.reduce((s, x) => s + x.expenseCents, 0) / withData.length) : 0;
  const highest = withData.reduce<(typeof withData)[number] | null>((m, s) => (!m || s.expenseCents > m.expenseCents ? s : m), null);
  const latest = data.months[data.months.length - 1];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="grid grid-cols-2 gap-3 lg:col-span-2 lg:grid-cols-4">
        <Stat label={t('analytics.totalIncome')} value={f.money(totals.income)} tone="income" />
        <Stat label={t('analytics.totalExpenses')} value={f.money(totals.expense)} />
        <Stat label={t('analytics.net')} value={f.money(net, { signed: true })} tone={net < 0 ? 'expense' : 'income'} />
        <Stat label={t('analytics.savingsRate')} value={totals.income > 0 ? f.percent(percentOf(net, totals.income)) : '—'} />
      </div>

      <Card>
        <CardHeader title={t('analytics.incomeVsExpenses')} />
        <ChartLegend items={[{ label: t('dashboard.income'), color: INCOME_COLOR }, { label: t('dashboard.expenses'), color: EXPENSE_COLOR }]} />
        <BarChart
          groups={groups('income')}
          series={[
            { id: 'income', label: t('dashboard.income'), color: INCOME_COLOR },
            { id: 'expense', label: t('dashboard.expenses'), color: EXPENSE_COLOR },
          ]}
          formatValue={(v) => f.money(v)}
          formatTick={tick}
          tableCaption={t('analytics.incomeVsExpenses')}
          highlightKey={latest}
        />
      </Card>

      <Card>
        <CardHeader title={t('analytics.monthlyBalance')} subtitle={t('dashboard.balanceHelp')} />
        <BarChart
          groups={groups('balance')}
          series={[{ id: 'balance', label: t('dashboard.balance'), color: 'var(--color-brand)', negativeColor: EXPENSE_COLOR }]}
          formatValue={(v) => f.money(v, { signed: true })}
          formatTick={tick}
          tableCaption={t('analytics.monthlyBalance')}
          highlightKey={latest}
        />
      </Card>

      <Card>
        <CardHeader
          title={t('analytics.monthlyExpenses')}
          subtitle={
            <>
              {t('analytics.average', { amount: f.money(avgExpense) })}
              {highest && ` · ${t('analytics.highest', { month: f.month(highest.month, 'short') })}`}
            </>
          }
        />
        <BarChart
          groups={groups('expense')}
          series={[{ id: 'expense', label: t('dashboard.expenses'), color: EXPENSE_COLOR }]}
          formatValue={(v) => f.money(v)}
          formatTick={tick}
          tableCaption={t('analytics.monthlyExpenses')}
          highlightKey={latest}
        />
      </Card>

      <CategoryDonut data={data} />
      <MonthComparison data={data} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'income' | 'expense' }) {
  return (
    <Card className="p-4">
      <p className="truncate text-[13px] text-ink-3">{label}</p>
      <p className={cn('mt-1 truncate text-lg font-bold tabular', tone === 'income' ? 'text-income' : tone === 'expense' ? 'text-expense' : 'text-ink')}>{value}</p>
    </Card>
  );
}

function MonthSelect({ label, value, onChange, months }: { label: string; value: string; onChange: (m: string) => void; months: string[] }) {
  const f = useFormat();
  return (
    <Field label={label} className="min-w-0 flex-1">
      {(p) => (
        <Select {...p} value={value} onChange={(e) => onChange(e.target.value)}>
          {[...months].reverse().map((m) => (
            <option key={m} value={m}>
              {f.month(m)}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

function CategoryDonut({ data }: { data: AnalyticsDTO }) {
  const { t } = useI18n();
  const f = useFormat();
  const { category, categoryLabelById } = useLookups();
  const [month, setMonth] = useState(data.months[data.months.length - 1]);
  const selected = data.months.includes(month) ? month : data.months[data.months.length - 1];
  const items: CategoryAmount[] = Object.entries(data.expensesByMonth[selected] ?? {})
    .map(([categoryId, amountCents]) => ({ categoryId, amountCents, count: 0 }))
    .sort((a, b) => b.amountCents - a.amountCents);
  const total = items.reduce((s, c) => s + c.amountCents, 0);
  const segments = toSegments(items, categoryLabelById, (id) => category(id)?.color ?? '#c3c2b7', t('categories.rest'));

  return (
    <Card>
      <CardHeader title={t('analytics.expensesByCategory')} />
      <MonthSelect label={t('common.month')} value={selected} onChange={setMonth} months={data.months} />
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-3">{t('dashboard.noExpenses')}</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
          <DonutChart
            segments={segments}
            centerTitle={t('dashboard.expenses')}
            centerValue={f.money(total, { whole: total >= 100_000 })}
            formatValue={(v) => f.money(v)}
            tableCaption={`${t('analytics.expensesByCategory')} — ${f.month(selected)}`}
          />
          <ul className="space-y-2">
            {segments.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-[14px]">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-ink-2">{s.label}</span>
                <span className="shrink-0 font-semibold text-ink tabular">{f.money(s.value)}</span>
                <span className="w-12 shrink-0 text-right text-[12px] text-ink-3 tabular">{f.percent(percentOf(s.value, total))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function MonthComparison({ data }: { data: AnalyticsDTO }) {
  const { t } = useI18n();
  const f = useFormat();
  const { category, categoryLabelById } = useLookups();
  const months = data.months;
  const [a, setA] = useState(months[Math.max(0, months.length - 2)]);
  const [b, setB] = useState(months[months.length - 1]);
  const ma = months.includes(a) ? a : months[Math.max(0, months.length - 2)];
  const mb = months.includes(b) ? b : months[months.length - 1];
  const totalA = data.series.find((s) => s.month === ma)?.expenseCents ?? 0;
  const totalB = data.series.find((s) => s.month === mb)?.expenseCents ?? 0;
  const cmp = compareAmounts(totalA, totalB);
  const rows = useMemo(() => compareCategories(data.expensesByMonth[ma] ?? {}, data.expensesByMonth[mb] ?? {}), [data, ma, mb]);
  const maxValue = Math.max(1, ...rows.flatMap((r) => [r.fromCents, r.toCents]));

  return (
    <Card className="lg:col-span-2">
      <CardHeader title={t('analytics.monthComparison')} subtitle={t('analytics.categoryComparison')} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <MonthSelect label={t('common.month')} value={ma} onChange={setA} months={months} />
        <p className="pb-3 text-center text-sm text-ink-3 sm:px-1">{t('analytics.compareWith')}</p>
        <MonthSelect label={t('common.month')} value={mb} onChange={setB} months={months} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label={f.month(ma, 'long')} value={f.money(totalA)} />
        <MiniStat label={f.month(mb, 'long')} value={f.money(totalB)} />
        <MiniStat label={t('analytics.difference')} value={f.money(cmp.diffCents, { signed: true })} tone={cmp.diffCents > 0 ? 'up' : cmp.diffCents < 0 ? 'down' : undefined} />
        <MiniStat
          label={t('analytics.change')}
          value={cmp.percent === null ? '—' : f.percent(cmp.percent, { signed: true })}
          tone={cmp.diffCents > 0 ? 'up' : cmp.diffCents < 0 ? 'down' : undefined}
        />
      </div>

      {rows.length > 0 && (
        <ul className="mt-5 space-y-3">
          {rows.map((r) => {
            const cat = category(r.categoryId);
            const Icon = r.diffCents > 0 ? ArrowUp : r.diffCents < 0 ? ArrowDown : Minus;
            return (
              <li key={r.categoryId} className="flex items-center gap-3">
                <CategoryBadge category={cat} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[14px] font-medium text-ink">{categoryLabelById(r.categoryId)}</span>
                    <span className={cn('flex shrink-0 items-center gap-0.5 text-[13px] font-semibold tabular', r.diffCents > 0 ? 'text-expense' : r.diffCents < 0 ? 'text-income' : 'text-ink-3')}>
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                      {f.money(r.diffCents, { signed: true })}
                      {r.percent !== null ? ` (${f.percent(r.percent, { signed: true })})` : r.toCents > 0 ? ` (${t('analytics.newCategory')})` : ''}
                    </span>
                  </div>
                  <div className="mt-1.5 space-y-1" aria-hidden>
                    <div className="h-1.5 rounded-full bg-surface-2">
                      <div className="h-full rounded-full opacity-45" style={{ width: `${(r.fromCents / maxValue) * 100}%`, background: cat?.color ?? '#898781' }} />
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-2">
                      <div className="h-full rounded-full" style={{ width: `${(r.toCents / maxValue) * 100}%`, background: cat?.color ?? '#898781' }} />
                    </div>
                  </div>
                  <p className="mt-1 text-[12px] text-ink-3 tabular">
                    {f.month(ma, 'short')}: {f.money(r.fromCents)} · {f.month(mb, 'short')}: {f.money(r.toCents)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' }) {
  return (
    <div className="min-w-0 rounded-2xl bg-surface-2 p-3">
      <p className="truncate text-[12px] text-ink-3">{label}</p>
      <p className={cn('mt-0.5 truncate text-[16px] font-bold tabular', tone === 'up' ? 'text-expense' : tone === 'down' ? 'text-income' : 'text-ink')}>{value}</p>
    </div>
  );
}
