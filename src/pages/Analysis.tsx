import { useMemo } from 'react';
import { CategoryIcon } from '../components/CategoryIcon';
import { BalanceBars, ExpenseLine, IncomeExpenseBars, SavingsLine } from '../components/charts/MonthlyCharts';
import { MonthSelector } from '../components/MonthSelector';
import { PageHeader } from '../components/PageHeader';
import { Card, CardTitle } from '../components/ui/Card';
import { cn } from '../components/ui/cn';
import { EmptyState } from '../components/ui/EmptyState';
import { addMonths, formatMonthYear, monthsBetween } from '../lib/dates';
import { compareCategories, delta, expensesByCategory, inMonth, monthlyFlows, type Delta } from '../lib/finance/cashflow';
import { formatEUR, formatPercent, percentOf } from '../lib/money';
import { useAppState } from '../state/app';
import { useStore } from '../state/data';
import { T } from '../texts';

const a = T.analysis;

export function AnalysisPage() {
  const store = useStore();
  const { month } = useAppState();

  const data = useMemo(() => {
    const previous = addMonths(month, -1);
    const current = inMonth(store.transactions, month);
    const prev = inMonth(store.transactions, previous);
    const flows = monthlyFlows(store.transactions, monthsBetween(addMonths(month, -5), month));
    const [prevFlow, curFlow] = flows.slice(-2);
    return {
      previous,
      byCategory: expensesByCategory(current),
      flows,
      curFlow,
      prevFlow,
      categories: compareCategories(current, prev),
      hasHistory: flows.some((f) => f.incomeCount > 0 || f.expenseCount > 0),
    };
  }, [store.transactions, month]);

  const { byCategory, curFlow, prevFlow } = data;
  const top = byCategory[0];
  const topCategory = top ? store.categoryById.get(top.categoryId) : undefined;
  const maxCategory = byCategory[0]?.cents ?? 0;

  return (
    <>
      <PageHeader title={a.title} />
      <div className="space-y-3">
        <MonthSelector />

        {top ? (
          <Card data-testid="top-category">
            <p className="mb-2 text-[13px] font-medium text-ink-3">{a.topCategory}</p>
            <div className="flex items-center gap-3">
              <CategoryIcon category={topCategory} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[18px] font-bold">{topCategory?.name ?? '—'}</p>
                <p className="text-[13px] text-ink-3">{a.ofMonthTotal(formatPercent(percentOf(top.cents, curFlow.expenseCents), 0))}</p>
              </div>
              <p className="money shrink-0 text-[20px] font-bold">{formatEUR(top.cents)}</p>
            </div>
          </Card>
        ) : null}

        <Card>
          <CardTitle>{a.byCategory}</CardTitle>
          {byCategory.length === 0 ? (
            <EmptyState icon="🧾" title={a.noExpenses} className="py-4" />
          ) : (
            <ul className="space-y-3.5" data-testid="category-bars">
              {byCategory.map((c) => {
                const cat = store.categoryById.get(c.categoryId);
                return (
                  <li key={c.categoryId}>
                    <div className="flex min-w-0 items-center gap-2">
                      <span aria-hidden>{cat?.emoji}</span>
                      <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{cat?.name ?? '—'}</span>
                      <span className="money shrink-0 text-[15px] font-semibold">{formatEUR(c.cents)}</span>
                      <span className="money w-12 shrink-0 text-right text-[13px] text-ink-3">{formatPercent(percentOf(c.cents, curFlow.expenseCents), 0)}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-soft">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(1.5, percentOf(c.cents, maxCategory))}%`, backgroundColor: cat?.color ?? '#94A3B8' }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card data-testid="comparison">
          <CardTitle subtitle={a.comparisonSubtitle(formatMonthYear(month, false), formatMonthYear(data.previous, false))}>{a.comparison}</CardTitle>
          <div className="divide-y divide-line">
            <CompareRow label={T.common.expenses} previous={prevFlow.expenseCents} current={curFlow.expenseCents} goodWhenUp={false} />
            <CompareRow label={T.common.income} previous={prevFlow.incomeCents} current={curFlow.incomeCents} goodWhenUp />
            <CompareRow label={T.dashboard.balance} previous={prevFlow.balanceCents} current={curFlow.balanceCents} goodWhenUp signed />
          </div>
          {data.categories.length > 0 && (
            <>
              <p className="mb-1 mt-5 text-[14px] font-semibold text-ink-2">{a.perCategoryComparison}</p>
              <ul className="divide-y divide-line" data-testid="category-comparison">
                {data.categories.map((c) => {
                  const cat = store.categoryById.get(c.categoryId);
                  return (
                    <li key={c.categoryId} className="py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span aria-hidden>{cat?.emoji}</span>
                        <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{cat?.name ?? '—'}</span>
                        <DiffAmount diff={c.diffCents} goodWhenUp={false} />
                      </div>
                      <p className="money mt-0.5 pl-7 text-[13px] text-ink-3">
                        {formatEUR(c.previousCents)} → {formatEUR(c.currentCents)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>

        <Card>
          <CardTitle subtitle={a.lastSixMonths}>{a.incomeVsExpenses}</CardTitle>
          {data.hasHistory ? <IncomeExpenseBars data={data.flows} /> : <EmptyState icon="📊" title={a.noData} className="py-4" />}
        </Card>

        <Card>
          <CardTitle subtitle={a.lastSixMonths}>{a.expenseTrend}</CardTitle>
          {data.hasHistory ? <ExpenseLine data={data.flows} /> : <EmptyState icon="📉" title={a.noData} className="py-4" />}
        </Card>

        <Card>
          <CardTitle subtitle={a.lastSixMonths}>{a.monthlyBalance}</CardTitle>
          {data.hasHistory ? <BalanceBars data={data.flows} /> : <EmptyState icon="⚖️" title={a.noData} className="py-4" />}
        </Card>

        <Card>
          <CardTitle subtitle={a.lastSixMonths}>{a.savingsRate}</CardTitle>
          {data.flows.some((f) => f.savingsRate !== null) ? <SavingsLine data={data.flows} /> : <EmptyState icon="🐷" title={a.noData} className="py-4" />}
        </Card>
      </div>
    </>
  );
}

function tone(d: Delta, goodWhenUp: boolean): string {
  if (d.diffCents === 0) return 'text-ink-3';
  const good = goodWhenUp ? d.diffCents > 0 : d.diffCents < 0;
  return good ? 'text-income-ink' : 'text-expense-ink';
}

function DiffAmount({ diff, goodWhenUp }: { diff: number; goodWhenUp: boolean }) {
  return (
    <span className={cn('money shrink-0 text-[15px] font-semibold', tone({ diffCents: diff, pct: null }, goodWhenUp))}>
      {diff === 0 ? a.noChange : formatEUR(diff, { signed: true })}
    </span>
  );
}

/** "Despeses   700,00 € → 630,00 €   −70,00 € (−10 %)" on two lines so nothing overlaps. */
function CompareRow({ label, previous, current, goodWhenUp, signed = false }: { label: string; previous: number; current: number; goodWhenUp: boolean; signed?: boolean }) {
  const d = delta(current, previous);
  return (
    <div className="py-2.5" data-testid={`compare-${label}`}>
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{label}</span>
        <span className={cn('money shrink-0 text-[15px] font-semibold', tone(d, goodWhenUp))}>
          {d.diffCents === 0 ? a.noChange : formatEUR(d.diffCents, { signed: true })}
          {d.pct !== null && d.diffCents !== 0 && <span className="ml-1 text-[13px] font-medium">({formatPercent(d.pct, 0, { signed: true })})</span>}
        </span>
      </div>
      <p className="money mt-0.5 text-[13px] text-ink-3">
        {formatEUR(previous, { signed })} → {formatEUR(current, { signed })}
      </p>
    </div>
  );
}
