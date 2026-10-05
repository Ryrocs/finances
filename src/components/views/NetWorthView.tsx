'use client';

import { ChevronRight, Plus, TrendingDown, TrendingUp, TriangleAlert, Wallet } from 'lucide-react';
import { useState } from 'react';
import { AreaChart } from '@/components/charts/AreaChart';
import { useI18n } from '@/components/providers/I18nProvider';
import { PageHeader } from '@/components/shell/PageHeader';
import { useSheets } from '@/components/shell/Sheets';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, SectionTitle } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';
import { IconBadge, accountIcon } from '@/components/ui/icons';
import { Segmented } from '@/components/ui/Segmented';
import { Badge, EmptyState, ErrorState, PageSkeleton } from '@/components/ui/States';
import { useAccounts, useNetWorth } from '@/hooks/api';
import { useFormat } from '@/hooks/useFormat';
import { percentOf } from '@/lib/money';
import { NET_WORTH_PERIODS, type AccountDTO, type NetWorthDTO, type NetWorthPeriod } from '@/lib/types';
import { DemoBanner } from './DemoBanner';

export function NetWorthView() {
  const { t } = useI18n();
  const [period, setPeriod] = useState<NetWorthPeriod>('6m');
  const { data: accounts = [] } = useAccounts();
  const query = useNetWorth(period);
  const { openAccount } = useSheets();

  return (
    <>
      <PageHeader
        title={t('netWorth.title')}
        actions={
          <div className="hidden sm:block">
            <Button variant="soft" size="sm" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => openAccount()}>
              {t('netWorth.addAccount')}
            </Button>
          </div>
        }
      />
      <DemoBanner />
      {accounts.length === 0 ? (
        <Card>
          <EmptyState
            icon={Wallet}
            title={t('netWorth.emptyTitle')}
            text={t('netWorth.emptyText')}
            action={<Button onClick={() => openAccount()}>{t('netWorth.addAccount')}</Button>}
          />
        </Card>
      ) : query.isPending ? (
        <PageSkeleton cards={2} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <NetWorthContent data={query.data} period={period} onPeriod={setPeriod} />
      )}
    </>
  );
}

function NetWorthContent({ data, period, onPeriod }: { data: NetWorthDTO; period: NetWorthPeriod; onPeriod: (p: NetWorthPeriod) => void }) {
  const { t } = useI18n();
  const f = useFormat();
  const { openAccount } = useSheets();
  const liquid = data.accounts.filter((a) => a.isLiquid);
  const nonLiquid = data.accounts.filter((a) => !a.isLiquid);
  const positiveTotal = liquid.reduce((s, a) => s + Math.max(0, a.balanceCents), 0);
  const up = data.change.diffCents >= 0;
  const spanDays = data.series.length > 1 ? data.series.length : 0;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card className="overflow-hidden">
          <p className="text-sm font-medium text-ink-3">{t('netWorth.totalLiquid')}</p>
          <p className={cn('mt-1 break-words text-[40px] font-bold leading-none tracking-tight tabular max-[359px]:text-[34px]', data.liquidCents < 0 && 'text-expense')}>
            {f.money(data.liquidCents)}
          </p>
          <p className={cn('mt-2 flex items-center gap-1.5 text-[14px] font-medium', up ? 'text-income' : 'text-expense')}>
            {up ? <TrendingUp className="h-4 w-4" aria-hidden /> : <TrendingDown className="h-4 w-4" aria-hidden />}
            {t('netWorth.changeInPeriod', {
              amount: f.money(data.change.diffCents, { signed: true }),
              percent: data.change.percent === null ? '—' : f.percent(data.change.percent, { signed: true, digits: 1 }),
            })}
          </p>
          {data.liquidCents < 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-[13px] text-expense">
              <TriangleAlert className="h-4 w-4" aria-hidden />
              {t('netWorth.negative')}
            </p>
          )}
          <p className="mt-3 text-[13px] leading-snug text-ink-3">{t('netWorth.explainer')}</p>

          <Segmented<NetWorthPeriod>
            className="mt-4"
            size="sm"
            label={t('netWorth.history')}
            value={period}
            onChange={onPeriod}
            options={NET_WORTH_PERIODS.map((p) => ({ value: p, label: t(`netWorth.periods.${p}`) }))}
          />
          <div className="mt-6">
            <AreaChart
              points={data.series.map((p) => ({ x: p.date, y: p.cents }))}
              color="#2a78d6"
              formatValue={(v) => f.money(v)}
              formatTick={(v) => f.money(v, { compact: Math.abs(v) >= 1_000_00, whole: true })}
              formatX={(x) => (spanDays > 400 ? f.month(x.slice(0, 7), 'shortYear') : f.date(x, 'dayMonth'))}
              formatXFull={(x) => f.date(x, 'long')}
              tableCaption={`${t('netWorth.history')} — ${t(`netWorth.periodNames.${period}`)}`}
            />
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader title={t('netWorth.distribution')} />
          {positiveTotal > 0 && (
            <div className="mb-4 flex h-3 w-full gap-[2px] overflow-hidden rounded-full" aria-hidden>
              {liquid
                .filter((a) => a.balanceCents > 0)
                .map((a) => (
                  <div key={a.id} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(a.balanceCents / positiveTotal) * 100}%`, background: a.color }} />
                ))}
            </div>
          )}
          <ul className="-mx-2">
            {liquid.map((a) => (
              <AccountRow key={a.id} account={a} share={positiveTotal > 0 && a.balanceCents > 0 ? percentOf(a.balanceCents, positiveTotal) : null} onSelect={openAccount} />
            ))}
          </ul>
          <Button variant="soft" block className="mt-3" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => openAccount()}>
            {t('netWorth.addAccount')}
          </Button>
        </Card>
        {nonLiquid.length > 0 && (
          <div>
            <SectionTitle>{t('netWorth.nonLiquid')}</SectionTitle>
            <Card className="p-2 sm:p-2">
              <ul>
                {nonLiquid.map((a) => (
                  <AccountRow key={a.id} account={a} share={null} onSelect={openAccount} />
                ))}
              </ul>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export function AccountRow({ account, share, onSelect }: { account: AccountDTO; share: number | null; onSelect: (a: AccountDTO) => void }) {
  const { t } = useI18n();
  const f = useFormat();
  return (
    <li>
      <button type="button" onClick={() => onSelect(account)} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-surface-2">
        <IconBadge icon={accountIcon(account.type)} color={account.color} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-ink">{account.name}</span>
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[13px] text-ink-3">
              {t(`accountTypes.${account.type}`)}
              {share !== null && ` · ${f.percent(share)}`}
            </span>
            {account.isDemo && <Badge className="shrink-0">{t('common.demo')}</Badge>}
            {account.archived && <Badge className="shrink-0">{t('common.archived')}</Badge>}
          </span>
        </span>
        <span className={cn('shrink-0 text-[15px] font-semibold tabular', account.balanceCents < 0 ? 'text-expense' : 'text-ink')}>{f.money(account.balanceCents)}</span>
        <ChevronRight className="-ml-1 h-4 w-4 shrink-0 text-ink-4 max-[359px]:hidden" aria-hidden />
      </button>
    </li>
  );
}
