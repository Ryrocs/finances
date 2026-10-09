import { useMemo, useState } from 'react';
import { WealthArea } from '../components/charts/WealthArea';
import { PageHeader } from '../components/PageHeader';
import { FitAmount } from '../components/ui/Amount';
import { Card, CardTitle } from '../components/ui/Card';
import { cn } from '../components/ui/cn';
import { EmptyState } from '../components/ui/EmptyState';
import { Segmented } from '../components/ui/Segmented';
import { formatShortDate } from '../lib/dates';
import { balancesAsOf } from '../lib/finance/balances';
import { WEALTH_RANGES, wealthHistory, type WealthRange } from '../lib/finance/wealth';
import { formatEUR, formatPercent, percentOf } from '../lib/money';
import { useAppState } from '../state/app';
import { useStore } from '../state/data';
import { T } from '../texts';

const w = T.wealth;

export function WealthPage() {
  const { accounts, transactions } = useStore();
  const { today } = useAppState();
  const [range, setRange] = useState<WealthRange>('6m');
  const year = Number(today.slice(0, 4));

  const balances = useMemo(() => balancesAsOf(accounts, transactions, today), [accounts, transactions, today]);
  const total = useMemo(() => [...balances.values()].reduce((a, b) => a + b, 0), [balances]);
  const history = useMemo(() => wealthHistory(accounts, transactions, range, today), [accounts, transactions, range, today]);
  // Bars share the total of positive balances so a negative account can't push a bar past 100 %.
  const positiveTotal = [...balances.values()].reduce((a, b) => a + Math.max(0, b), 0);

  if (accounts.length === 0) {
    return (
      <>
        <PageHeader title={w.title} />
        <Card>
          <EmptyState icon="🏦" title={w.noAccounts} />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title={w.title} />
      <div className="space-y-3">
        <Card className="py-5">
          <p className="text-[14px] font-medium text-ink-3">{w.total}</p>
          <FitAmount cents={total} className="mt-1 text-[40px] font-bold leading-tight tracking-tight" testId="wealth-total" />
        </Card>

        <Card>
          <CardTitle>{w.distribution}</CardTitle>
          <ul className="space-y-3.5" data-testid="wealth-distribution">
            {accounts.map((a) => {
              const balance = balances.get(a.id) ?? 0;
              return (
                <li key={a.id} data-testid="wealth-account">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: a.color }} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{a.name}</span>
                    <span className={cn('money shrink-0 text-[15px] font-semibold', balance < 0 && 'text-expense-ink')}>{formatEUR(balance)}</span>
                    <span className="money w-12 shrink-0 text-right text-[13px] text-ink-3">{formatPercent(percentOf(balance, total), 0)}</span>
                  </div>
                  <div className="ml-[22px] mt-1.5 h-1.5 overflow-hidden rounded-full bg-soft">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, percentOf(balance, positiveTotal)))}%`, backgroundColor: a.color }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
            <span className="text-[15px] font-semibold">{T.common.total}</span>
            <span className="money text-[16px] font-bold">{formatEUR(total)}</span>
          </div>
        </Card>

        <Card>
          <CardTitle>{w.evolution}</CardTitle>
          <div className="mb-3">
            <Segmented label={w.evolution} size="sm" value={range} onChange={setRange} options={WEALTH_RANGES.map((r) => ({ value: r, label: w.rangesShort[r], ariaLabel: w.ranges[r] }))} />
          </div>
          {history ? (
            <>
              <WealthArea points={history.points} />
              <dl className="mt-4 grid grid-cols-2 gap-3" data-testid="wealth-stats">
                <Stat label={w.vsPreviousMonth} hint={w.vsPreviousMonthHint(formatShortDate(history.stats.vsPreviousMonth.referenceDate, year))}>
                  <span className={cn(history.stats.vsPreviousMonth.diffCents > 0 ? 'text-income-ink' : history.stats.vsPreviousMonth.diffCents < 0 ? 'text-expense-ink' : '')}>
                    <FitAmount cents={history.stats.vsPreviousMonth.diffCents} options={{ signed: true }} />
                    {history.stats.vsPreviousMonth.pct !== null && (
                      <span className="money block text-[13px] font-medium">{formatPercent(history.stats.vsPreviousMonth.pct, 1, { signed: true })}</span>
                    )}
                  </span>
                </Stat>
                <Stat label={w.current}>
                  <FitAmount cents={history.stats.currentCents} />
                </Stat>
                <Stat label={w.max} hint={formatShortDate(history.stats.maxDate, year)}>
                  <FitAmount cents={history.stats.maxCents} />
                </Stat>
                <Stat label={w.min} hint={formatShortDate(history.stats.minDate, year)}>
                  <FitAmount cents={history.stats.minCents} />
                </Stat>
              </dl>
            </>
          ) : (
            <EmptyState icon="📈" title={w.notStarted} className="py-4" />
          )}
        </Card>
      </div>
    </>
  );
}

function Stat({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-soft px-3 py-2.5">
      <dt className="truncate text-[12px] font-medium text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-[16px] font-bold">{children}</dd>
      {hint && <p className="truncate text-[12px] text-ink-3">{hint}</p>}
    </div>
  );
}
