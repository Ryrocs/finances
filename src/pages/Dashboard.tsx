import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { CategoryIcon } from '../components/CategoryIcon';
import { Donut, foldSlices } from '../components/charts/Donut';
import { MonthSelector } from '../components/MonthSelector';
import { PageHeader } from '../components/PageHeader';
import { FitAmount } from '../components/ui/Amount';
import { Card, CardTitle } from '../components/ui/Card';
import { cn } from '../components/ui/cn';
import { EmptyState } from '../components/ui/EmptyState';
import { formatShortDate, monthEnd, monthOf } from '../lib/dates';
import { wealthAsOf } from '../lib/finance/balances';
import { resolveBudget } from '../lib/finance/budget';
import { expensesByCategory, flowTotals, inMonth, savingsRate } from '../lib/finance/cashflow';
import { spendingPace, type Pace } from '../lib/finance/pace';
import { formatEUR, formatPercent, percentOf } from '../lib/money';
import { useAppState } from '../state/app';
import { useStore } from '../state/data';
import { T } from '../texts';

const t = T.dashboard;

export function DashboardPage() {
  const store = useStore();
  const { month, today } = useAppState();
  const navigate = useNavigate();

  const data = useMemo(() => {
    const monthTxs = inMonth(store.transactions, month);
    const totals = flowTotals(monthTxs);
    const isCurrent = month === monthOf(today);
    const wealthDate = isCurrent ? today : monthEnd(month);
    const { budget } = resolveBudget(store.budgets, month);
    return {
      count: monthTxs.length,
      totals,
      rate: savingsRate(totals.incomeCents, totals.balanceCents),
      isCurrent,
      wealthDate,
      wealth: wealthAsOf(store.accounts, store.transactions, wealthDate),
      pace: spendingPace({ month, today, spentCents: totals.expenseCents, expenseCount: totals.expenseCount, budgetCents: budget?.totalCents }),
      byCategory: expensesByCategory(monthTxs),
    };
  }, [store.transactions, store.accounts, store.budgets, month, today]);

  const { totals, rate } = data;
  const balanceTone = totals.balanceCents > 0 ? 'text-income-ink' : totals.balanceCents < 0 ? 'text-expense-ink' : 'text-ink';

  return (
    <>
      <PageHeader title={t.title} />
      <div className="space-y-3">
        <MonthSelector />

        <div className="grid grid-cols-2 gap-3">
          <StatCard label={t.income} testId="card-income">
            <FitAmount cents={totals.incomeCents} className="text-[22px] font-bold text-income-ink" testId="value-income" />
          </StatCard>
          <StatCard label={t.expenses} testId="card-expenses">
            <FitAmount cents={totals.expenseCents} className="text-[22px] font-bold text-expense-ink" testId="value-expenses" />
          </StatCard>
          <StatCard label={t.balance} testId="card-balance">
            <FitAmount cents={totals.balanceCents} options={{ signed: true }} className={cn('text-[22px] font-bold', balanceTone)} testId="value-balance" />
            {totals.balanceCents !== 0 && (
              <p className={cn('mt-0.5 flex flex-wrap gap-x-1.5 text-[13px] font-medium leading-snug', balanceTone)} data-testid="value-savings">
                <span>{totals.balanceCents > 0 ? t.surplus : t.deficit}</span>
                {rate !== null && <span className="money">{t.savingsRate(formatPercent(rate))}</span>}
              </p>
            )}
          </StatCard>
          <StatCard label={t.wealth} testId="card-wealth">
            <FitAmount cents={data.wealth} className="text-[22px] font-bold" testId="value-wealth" />
            <p className="mt-0.5 truncate text-[13px] text-ink-3">{data.isCurrent ? t.wealthToday : t.wealthAt(formatShortDate(data.wealthDate, Number(today.slice(0, 4))))}</p>
          </StatCard>
        </div>

        {totals.balanceCents !== 0 && (
          <p
            className={cn(
              'rounded-2xl px-4 py-3 text-[15px] font-medium',
              totals.balanceCents > 0 ? 'bg-income-soft text-income-ink' : 'bg-expense-soft text-expense-ink',
            )}
            data-testid="balance-message"
          >
            {totals.balanceCents > 0 ? t.positiveMessage : t.negativeMessage}
          </p>
        )}

        {data.pace && <PaceCard pace={data.pace} />}

        <Card>
          <CardTitle>{t.byCategory}</CardTitle>
          {data.byCategory.length === 0 ? (
            data.count === 0 ? (
              <EmptyState icon="🧾" title={t.emptyMonth} hint={t.emptyMonthHint} className="py-4" />
            ) : (
              <EmptyState icon="🧾" title={t.noExpenses} className="py-4" />
            )
          ) : (
            <>
              <Donut
                centerLabel={t.expenses}
                centerValue={totals.expenseCents}
                slices={foldSlices(
                  data.byCategory.map((c) => {
                    const cat = store.categoryById.get(c.categoryId);
                    return { id: c.categoryId, label: cat?.name ?? '—', color: cat?.color ?? '#94A3B8', value: c.cents };
                  }),
                  6,
                  t.restSlice,
                )}
              />
              <ul className="-mx-2 mt-4" data-testid="category-list">
                {data.byCategory.map((c) => {
                  const cat = store.categoryById.get(c.categoryId);
                  return (
                    <li key={c.categoryId}>
                      <button
                        type="button"
                        onClick={() => navigate(`/moviments?categoria=${encodeURIComponent(c.categoryId)}`)}
                        aria-label={t.seeMovements(cat?.name ?? '')}
                        className="flex min-h-[52px] w-full min-w-0 items-center gap-3 rounded-xl px-2 py-1.5 text-left active:bg-soft"
                      >
                        <CategoryIcon category={cat} size="sm" />
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: cat?.color }} aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{cat?.name ?? '—'}</span>
                        <span className="money shrink-0 text-[15px] font-semibold">{formatEUR(c.cents)}</span>
                        <span className="money w-12 shrink-0 text-right text-[13px] text-ink-3">{formatPercent(percentOf(c.cents, totals.expenseCents), 0)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>
      </div>
    </>
  );
}

function StatCard({ label, children, testId }: { label: string; children: React.ReactNode; testId?: string }) {
  return (
    <Card className="flex min-h-[96px] flex-col justify-center px-4 py-3.5" data-testid={testId}>
      <p className="mb-1 truncate text-[13px] font-medium text-ink-3">{label}</p>
      {children}
    </Card>
  );
}

function PaceCard({ pace }: { pace: Pace }) {
  const used = pace.budgetPct;
  return (
    <Card data-testid="pace-card">
      <CardTitle action={<span className="text-[13px] font-medium text-ink-3">{t.paceDays(pace.daysElapsed, pace.daysInMonth)}</span>}>{t.pace}</CardTitle>
      {used !== null && (
        <div className="mb-3">
          <div className="relative h-2.5 overflow-hidden rounded-full bg-soft-2" role="img" aria-label={`${t.paceBudget}: ${formatPercent(used, 0)}`}>
            <div className={cn('h-full rounded-full', pace.warning ? 'bg-warning' : 'bg-ink')} style={{ width: `${Math.min(100, used)}%` }} />
          </div>
          {/* Where the month is: spending ahead of this mark means going faster than planned. */}
          <div className="relative h-3">
            <span className="absolute top-0 h-3 w-0.5 -translate-x-1/2 rounded-full bg-ink-3" style={{ left: `${pace.monthPct}%` }} aria-hidden />
          </div>
        </div>
      )}
      <dl className={cn('grid gap-2', used !== null ? 'grid-cols-3' : 'grid-cols-2')}>
        <Metric label={t.paceSpent}>
          <FitAmount cents={pace.spentCents} testId="pace-spent" />
        </Metric>
        {used !== null && <Metric label={t.paceBudget}>{formatPercent(used, 0)}</Metric>}
        <Metric label={t.paceProjected}>
          <FitAmount cents={pace.projectedCents} testId="pace-projected" />
        </Metric>
      </dl>
      {pace.warning && (
        <p className="mt-3 rounded-xl bg-warning-soft px-3 py-2 text-[14px] font-medium text-warning-ink" data-testid="pace-warning">
          {t.paceWarning}
        </p>
      )}
      <p className="mt-3 text-[14px] leading-snug text-ink-2">{t.paceText(formatEUR(pace.projectedCents))}</p>
    </Card>
  );
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[12px] text-ink-3">{label}</dt>
      <dd className="money text-[15px] font-semibold">{children}</dd>
    </div>
  );
}
