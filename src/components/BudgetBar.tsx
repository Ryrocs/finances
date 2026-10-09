import type { BudgetLine } from '../lib/finance/budget';
import { formatEUR, formatPercent } from '../lib/money';
import { T } from '../texts';
import { cn } from './ui/cn';

const BAR = { ok: 'bg-income', near: 'bg-warning', over: 'bg-expense' } as const;

/** "72,00 € / 80,00 €", a progress bar, the percentage and the status (near the limit / exceeded). */
export function BudgetProgress({ line, title, testId }: { line: BudgetLine; title: React.ReactNode; testId?: string }) {
  const b = T.budget;
  return (
    <div data-testid={testId} data-level={line.level}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1 truncate text-[15px] font-semibold">{title}</div>
        <span className={cn('money shrink-0 text-[14px] font-semibold', line.level === 'over' ? 'text-expense-ink' : line.level === 'near' ? 'text-warning-ink' : 'text-ink-2')}>
          {formatPercent(line.pct, 0)}
        </span>
      </div>
      <p className="money mt-0.5 text-[14px] text-ink-2">{b.spentOf(formatEUR(line.spentCents), formatEUR(line.budgetCents))}</p>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-soft-2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(100, line.pct))}
      >
        <div className={cn('h-full rounded-full', BAR[line.level])} style={{ width: `${Math.min(100, line.pct)}%` }} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 text-[13px]">
        {line.level === 'over' ? (
          <span className="font-semibold text-expense-ink">{b.over}</span>
        ) : line.level === 'near' ? (
          <span className="font-semibold text-warning-ink">{b.near}</span>
        ) : (
          <span />
        )}
        <span className="money text-ink-3">{line.remainingCents >= 0 ? b.remaining(formatEUR(line.remainingCents)) : b.exceededBy(formatEUR(-line.remainingCents))}</span>
      </div>
    </div>
  );
}
