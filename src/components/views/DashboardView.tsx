'use client';

import { ArrowDownLeft, ArrowUpRight, ChevronRight, Gauge, Sparkles, TriangleAlert, Wallet } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useI18n } from '@/components/providers/I18nProvider';
import { MonthSwitcher } from '@/components/shell/MonthSwitcher';
import { useMonth } from '@/components/shell/MonthContext';
import { PageHeader } from '@/components/shell/PageHeader';
import { useSheets } from '@/components/shell/Sheets';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';
import { useToast } from '@/components/ui/Toast';
import { EmptyState, ErrorState, PageSkeleton, ProgressBar, Badge } from '@/components/ui/States';
import { useAccounts, useDemoData, useMe, useSummary } from '@/hooks/api';
import { useFormat, useLookups } from '@/hooks/useFormat';
import { compareAmounts } from '@/lib/finance/cashflow';
import { MIN_DAYS_FOR_PROJECTION } from '@/lib/finance/projection';
import type { MonthSummaryDTO } from '@/lib/types';
import { DemoBanner } from './DemoBanner';
import { ExpenseBreakdown } from './ExpenseBreakdown';
import { MovementRow } from './MovementRow';

export function DashboardView() {
  const { t } = useI18n();
  const { month } = useMonth();
  const { data: me } = useMe();
  const { data: accounts = [] } = useAccounts();
  const summary = useSummary(month);
  const greeting = me?.name ? t('dashboard.greeting', { name: me.name.split(' ')[0] }) : t('dashboard.greetingNoName');

  return (
    <>
      <PageHeader title={greeting} />
      <DemoBanner />
      {accounts.length === 0 ? (
        <Welcome />
      ) : (
        <div className="space-y-4">
          <MonthSwitcher className="lg:max-w-sm" />
          {summary.isPending ? (
            <PageSkeleton />
          ) : summary.isError ? (
            <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
          ) : (
            <DashboardContent summary={summary.data} />
          )}
        </div>
      )}
    </>
  );
}

function Welcome() {
  const { t } = useI18n();
  const { openAccount } = useSheets();
  const { load } = useDemoData();
  const toast = useToast();
  return (
    <Card className="mt-2">
      <EmptyState
        icon={Wallet}
        title={t('dashboard.welcomeTitle')}
        text={t('dashboard.welcomeText')}
        action={
          <>
            <Button block onClick={() => openAccount()}>
              {t('dashboard.createFirstAccount')}
            </Button>
            <Button
              block
              variant="soft"
              loading={load.isPending}
              icon={<Sparkles className="h-4 w-4" aria-hidden />}
              onClick={() => load.mutate(undefined, { onSuccess: () => toast.show(t('settings.demoLoaded')) })}
            >
              {t('dashboard.exploreDemo')}
            </Button>
          </>
        }
      />
    </Card>
  );
}

function DashboardContent({ summary }: { summary: MonthSummaryDTO }) {
  const { t } = useI18n();
  const f = useFormat();
  const { openEditMovement } = useSheets();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <BalanceHero summary={summary} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NetWorthCard summary={summary} />
          <SpendingRateCard summary={summary} />
        </div>
        <ExpenseBreakdown summary={summary} />
      </div>
      <div className="space-y-4">
        <BudgetCard summary={summary} />
        <Card>
          <CardHeader
            title={t('dashboard.recentMovements')}
            action={
              <Link href="/movements" className="flex h-9 items-center gap-0.5 rounded-xl px-2 text-sm font-semibold text-brand hover:bg-brand-soft">
                {t('common.seeAll')}
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            }
          />
          {summary.recent.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-3">{t('dashboard.noMovements')}</p>
          ) : (
            <ul className="-mx-2">
              {summary.recent.map((tx) => (
                <MovementRow key={tx.id} tx={tx} onSelect={openEditMovement} />
              ))}
            </ul>
          )}
        </Card>
        <p className="sr-only" aria-live="polite">
          {f.month(summary.month)}
        </p>
      </div>
    </div>
  );
}

function BalanceHero({ summary }: { summary: MonthSummaryDTO }) {
  const { t } = useI18n();
  const f = useFormat();
  const negative = summary.balanceCents < 0;
  const message =
    summary.balanceCents > 0
      ? t('dashboard.balancePositive', { amount: f.money(summary.balanceCents) })
      : negative
        ? t('dashboard.balanceNegative', { amount: f.money(-summary.balanceCents) })
        : t('dashboard.balanceZero');
  const incomeChange = compareAmounts(summary.previous.incomeCents, summary.incomeCents);
  const expenseChange = compareAmounts(summary.previous.expenseCents, summary.expenseCents);
  const prevName = f.month(summary.previous.month, 'short');

  return (
    <section
      aria-labelledby="balance-title"
      className={cn(
        'relative overflow-hidden rounded-[1.5rem] p-5 text-white shadow-card sm:p-6',
        negative ? 'bg-gradient-to-br from-rose-500 to-rose-700' : 'bg-gradient-to-br from-emerald-500 to-emerald-700',
      )}
    >
      <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10" aria-hidden />
      <div className="pointer-events-none absolute -bottom-16 right-16 h-36 w-36 rounded-full bg-white/5" aria-hidden />
      <p id="balance-title" className="text-sm font-medium text-white/85">
        {t('dashboard.balance')}
      </p>
      <p className="mt-1 break-words text-[40px] font-bold leading-none tracking-tight tabular max-[359px]:text-[34px]">
        {f.money(summary.balanceCents, { signed: true })}
      </p>
      <p className="mt-2 flex items-start gap-1.5 text-[14px] leading-snug text-white/90">
        {negative && <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
        {message}
      </p>
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <HeroStat
          icon={<ArrowDownLeft className="h-4 w-4" aria-hidden />}
          label={t('dashboard.income')}
          value={f.money(summary.incomeCents)}
          delta={incomeChange.percent}
          prevName={prevName}
        />
        <HeroStat
          icon={<ArrowUpRight className="h-4 w-4" aria-hidden />}
          label={t('dashboard.expenses')}
          value={f.money(summary.expenseCents)}
          delta={expenseChange.percent}
          prevName={prevName}
        />
      </div>
    </section>
  );
}

function HeroStat({ icon, label, value, delta, prevName }: { icon: ReactNode; label: string; value: string; delta: number | null; prevName: string }) {
  const { t } = useI18n();
  const f = useFormat();
  return (
    <div className="min-w-0 rounded-2xl bg-white/15 p-3 backdrop-blur-sm">
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-white/85">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">{icon}</span>
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-1.5 truncate text-lg font-bold leading-tight tabular">{value}</p>
      {delta !== null && (
        <p className="mt-0.5 truncate text-[12px] text-white/80">
          {f.percent(delta, { signed: true })} {t('dashboard.vsPrevious', { month: prevName })}
        </p>
      )}
    </div>
  );
}

function NetWorthCard({ summary }: { summary: MonthSummaryDTO }) {
  const { t } = useI18n();
  const f = useFormat();
  const negative = summary.netWorth.liquidCents < 0;
  return (
    <Link href="/net-worth" className="group block rounded-card border border-line/70 bg-surface p-4 shadow-card transition-colors hover:bg-surface-2/50 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-transfer-soft text-transfer">
            <Wallet className="h-4 w-4" aria-hidden />
          </span>
          {t('dashboard.liquidNetWorth')}
        </p>
        <ChevronRight className="h-5 w-5 text-ink-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </div>
      <p className={cn('mt-3 truncate text-[28px] font-bold leading-tight tracking-tight tabular', negative ? 'text-expense' : 'text-ink')}>
        {f.money(summary.netWorth.liquidCents)}
      </p>
      <p className="mt-0.5 text-[13px] text-ink-3">{t('dashboard.asOf', { date: f.date(summary.netWorth.asOf, 'long') })}</p>
    </Link>
  );
}

function SpendingRateCard({ summary }: { summary: MonthSummaryDTO }) {
  const { t } = useI18n();
  const f = useFormat();
  const p = summary.projection;

  let body: ReactNode;
  if (p.status === 'too_early') {
    body = <p className="text-[14px] leading-snug text-ink-2">{t('dashboard.projectionTooEarly', { day: MIN_DAYS_FOR_PROJECTION })}</p>;
  } else if (p.status === 'future') {
    body = <p className="text-[14px] text-ink-2">{t('dashboard.projectionFuture')}</p>;
  } else if (p.status === 'past') {
    body = (
      <p className="text-[14px] leading-snug text-ink-2">
        {t('dashboard.projectionPast', { amount: f.money(p.projectedCents), month: f.month(summary.month, 'long'), daily: f.money(p.dailyRateCents) })}
      </p>
    );
  } else {
    const ref =
      p.reference === 'budget'
        ? p.high
          ? t('dashboard.aboveBudget', { amount: f.money(p.projectedCents - p.referenceCents) })
          : t('dashboard.belowBudget', { amount: f.money(p.referenceCents) })
        : p.reference === 'average'
          ? p.high
            ? t('dashboard.aboveAverage', { amount: f.money(p.referenceCents, { whole: true }) })
            : t('dashboard.normalAverage', { amount: f.money(p.referenceCents, { whole: true }) })
          : p.reference === 'income'
            ? p.high
              ? t('dashboard.aboveIncome', { amount: f.money(p.referenceCents) })
              : t('dashboard.belowIncome', { amount: f.money(p.referenceCents) })
            : null;
    const progress = p.daysInMonth ? (p.daysElapsed / p.daysInMonth) * 100 : 0;
    body = (
      <>
        <p className="text-[14px] leading-snug text-ink-2">{t('dashboard.projection', { amount: f.money(p.projectedCents, { whole: true }) })}</p>
        {ref && <p className={cn('mt-1.5 text-[13px] leading-snug', p.high ? 'font-medium text-warning' : 'text-ink-3')}>{ref}</p>}
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[12px] text-ink-3">
            <span>{t('dashboard.daysElapsed', { day: p.daysElapsed, days: p.daysInMonth })}</span>
            <span className="tabular">
              {t('dashboard.dailyRate')}: {f.money(p.dailyRateCents)}
            </span>
          </div>
          <ProgressBar value={progress} level={p.high ? 'warning' : 'ok'} label={t('dashboard.daysElapsed', { day: p.daysElapsed, days: p.daysInMonth })} />
        </div>
        {p.fixedCents > 0 && <p className="mt-2 text-[12px] text-ink-4">{t('dashboard.projectionFixed', { amount: f.money(p.fixedCents) })}</p>}
      </>
    );
  }

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-xl', p.high ? 'bg-warning-soft text-warning' : 'bg-brand-soft text-brand')}>
            <Gauge className="h-4 w-4" aria-hidden />
          </span>
          {t('dashboard.spendingRate')}
        </p>
        {p.status === 'available' && (
          <Badge tone={p.high ? 'warning' : 'brand'}>
            {p.high && <TriangleAlert className="h-3 w-3" aria-hidden />}
            {p.high ? t('dashboard.highRate') : t('dashboard.onTrack')}
          </Badge>
        )}
      </div>
      {body}
    </Card>
  );
}

function BudgetCard({ summary }: { summary: MonthSummaryDTO }) {
  const { t } = useI18n();
  const f = useFormat();
  const { categoryLabelById } = useLookups();
  const { overall, categories } = summary.budgets;
  if (!overall && categories.length === 0) return null;
  const top = categories.slice(0, 3);
  return (
    <Card>
      <CardHeader
        title={t('dashboard.budgetStatus')}
        action={
          <ButtonLink href="/budget" variant="link" size="sm">
            {t('common.seeAll')}
          </ButtonLink>
        }
      />
      <div className="space-y-4">
        {overall && <BudgetLine name={t('budget.overallName')} status={overall} money={f.money} />}
        {top.map((b) => (
          <BudgetLine key={b.id} name={categoryLabelById(b.categoryId)} status={b} money={f.money} />
        ))}
      </div>
    </Card>
  );
}

function BudgetLine({
  name,
  status,
  money,
}: {
  name: string;
  status: { spentCents: number; budgetCents: number; remainingCents: number; percent: number; level: 'ok' | 'warning' | 'exceeded' };
  money: (c: number) => string;
}) {
  const { t } = useI18n();
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="truncate text-[14px] font-medium text-ink">{name}</span>
        <span className={cn('shrink-0 text-[13px] tabular', status.level === 'exceeded' ? 'font-semibold text-danger' : status.level === 'warning' ? 'font-semibold text-warning' : 'text-ink-3')}>
          {status.remainingCents >= 0 ? t('dashboard.left', { amount: money(status.remainingCents) }) : t('dashboard.over', { amount: money(-status.remainingCents) })}
        </span>
      </div>
      <ProgressBar value={status.percent} level={status.level} label={name} />
    </div>
  );
}
