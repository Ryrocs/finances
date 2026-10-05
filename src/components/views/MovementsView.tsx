'use client';

import { ArrowLeftRight, Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/components/providers/I18nProvider';
import { MonthSwitcher } from '@/components/shell/MonthSwitcher';
import { useMonth } from '@/components/shell/MonthContext';
import { PageHeader } from '@/components/shell/PageHeader';
import { useSheets } from '@/components/shell/Sheets';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';
import { Field, Select } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useTransactions, type MovementFilters } from '@/hooks/api';
import { useFormat, useLookups } from '@/hooks/useFormat';
import type { TransactionDTO, TransactionType } from '@/lib/types';
import { DemoBanner } from './DemoBanner';
import { MovementRow } from './MovementRow';

type Period = 'month' | 'all';
interface Filters {
  type: '' | TransactionType;
  categoryId: string;
  accountId: string;
  period: Period;
}
const EMPTY: Filters = { type: '', categoryId: '', accountId: '', period: 'month' };

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function MovementsView() {
  const { t, tp } = useI18n();
  const f = useFormat();
  const { month } = useMonth();
  const { categories, accounts, categoryLabel } = useLookups();
  const { openEditMovement, openNewMovement } = useSheets();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersKey, setFiltersKey] = useState(0);
  const q = useDebounced(search.trim());

  // Category names are translated on the client, so matching ids are sent along with the text.
  const cats = useMemo(() => {
    if (!q) return [];
    const needle = q.toLocaleLowerCase();
    return categories.filter((c) => categoryLabel(c).toLocaleLowerCase().includes(needle)).map((c) => c.id);
  }, [q, categories, categoryLabel]);

  const query: MovementFilters = {
    month: filters.period === 'month' ? month : undefined,
    type: filters.type || undefined,
    categoryId: filters.categoryId || undefined,
    accountId: filters.accountId || undefined,
    q: q || undefined,
    cats: cats.length ? cats : undefined,
  };
  const list = useTransactions(query);
  const items = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const totals = list.data?.pages[0]?.totals;
  const activeFilterCount = (filters.type ? 1 : 0) + (filters.categoryId ? 1 : 0) + (filters.accountId ? 1 : 0) + (filters.period === 'all' ? 1 : 0);
  const hasQuery = !!q || activeFilterCount > 0;

  // Auto-load the next page when the sentinel scrolls into view.
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !isFetchingNextPage) void fetchNextPage();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const groups = useMemo(() => {
    const map = new Map<string, TransactionDTO[]>();
    for (const tx of items) {
      const g = map.get(tx.date) ?? [];
      g.push(tx);
      map.set(tx.date, g);
    }
    return [...map.entries()];
  }, [items]);

  return (
    <>
      <PageHeader title={t('movements.title')} />
      <DemoBanner />
      <div className="space-y-3">
        {filters.period === 'month' && <MonthSwitcher className="lg:max-w-sm" />}
        <div className="flex gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">{t('common.search')}</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-4" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('movements.searchPlaceholder')}
              enterKeyHint="search"
              className="h-12 w-full rounded-2xl border border-line bg-surface pl-11 pr-10 text-base text-ink shadow-card outline-none placeholder:text-ink-4 focus:border-brand"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-ink-3"
                aria-label={t('common.clearFilters')}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
          </label>
          <Button
            variant="secondary"
            size="square"
            className="relative shadow-card"
            onClick={() => {
              setFiltersKey((k) => k + 1);
              setFiltersOpen(true);
            }}
            aria-label={t('common.filters')}
          >
            <SlidersHorizontal className="h-5 w-5" aria-hidden />
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        {totals && totals.count >= 0 && items.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[13px] text-ink-3" aria-live="polite">
            <span className="font-medium text-ink-2">{tp('movements.count', totals.count)}</span>
            {totals.incomeCents > 0 && <span className="text-income tabular">{f.money(totals.incomeCents, { signed: true })}</span>}
            {totals.expenseCents > 0 && <span className="tabular">{f.money(-totals.expenseCents)}</span>}
          </div>
        )}

        {list.isPending ? (
          <Card className="space-y-3" aria-busy>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-11 w-11 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </Card>
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : items.length === 0 ? (
          <Card>
            {hasQuery ? (
              <EmptyState
                icon={Search}
                title={t('movements.noResults')}
                action={
                  <Button
                    variant="soft"
                    onClick={() => {
                      setSearch('');
                      setFilters(EMPTY);
                    }}
                  >
                    {t('common.clearFilters')}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={ArrowLeftRight}
                title={t('movements.emptyTitle')}
                text={t('movements.emptyText')}
                action={<Button onClick={() => openNewMovement()}>{t('nav.addMovement')}</Button>}
              />
            )}
          </Card>
        ) : (
          <div className={cn('space-y-3 transition-opacity', list.isPlaceholderData && 'opacity-60')}>
            {groups.map(([date, txs]) => {
              const net = txs.reduce((s, x) => s + (x.type === 'income' ? x.amountCents : x.type === 'expense' ? -x.amountCents : 0), 0);
              return (
                <section key={date} aria-label={f.day(date)}>
                  <div className="mb-1 flex items-baseline justify-between px-2">
                    <h2 className="text-[13px] font-semibold text-ink-3">{f.day(date)}</h2>
                    {net !== 0 && <span className={cn('text-[12px] tabular', net > 0 ? 'text-income' : 'text-ink-3')}>{f.money(net, { signed: true })}</span>}
                  </div>
                  <Card className="p-2 sm:p-2">
                    <ul>
                      {txs.map((tx) => (
                        <MovementRow key={tx.id} tx={tx} onSelect={openEditMovement} />
                      ))}
                    </ul>
                  </Card>
                </section>
              );
            })}
            <div ref={sentinel} />
            {list.hasNextPage && (
              <Button variant="secondary" block loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
                {t('common.loadMore')}
              </Button>
            )}
          </div>
        )}
      </div>

      <FiltersSheet
        key={filtersKey}
        open={filtersOpen}
        initial={filters}
        onClose={() => setFiltersOpen(false)}
        onApply={(next) => {
          setFilters(next);
          setFiltersOpen(false);
        }}
        categories={categories}
        accounts={accounts}
        categoryLabel={categoryLabel}
        monthLabel={f.month(month)}
      />
    </>
  );
}

function FiltersSheet({
  open,
  initial,
  onClose,
  onApply,
  categories,
  accounts,
  categoryLabel,
  monthLabel,
}: {
  open: boolean;
  initial: Filters;
  onClose: () => void;
  onApply: (f: Filters) => void;
  categories: ReturnType<typeof useLookups>['categories'];
  accounts: ReturnType<typeof useLookups>['accounts'];
  categoryLabel: ReturnType<typeof useLookups>['categoryLabel'];
  monthLabel: string;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(initial);
  const visibleCategories = categories.filter((c) => !draft.type || draft.type === 'transfer' || c.kind === draft.type);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('common.filters')}
      footer={
        <div className="flex gap-2">
          <Button variant="soft" className="flex-1" onClick={() => onApply(EMPTY)}>
            {t('common.clearFilters')}
          </Button>
          <Button className="flex-1" onClick={() => onApply(draft)}>
            {t('common.apply')}
          </Button>
        </div>
      }
    >
      <div className="space-y-5 pt-1">
        <Segmented<Period>
          label={t('common.month')}
          value={draft.period}
          onChange={(period) => setDraft({ ...draft, period })}
          options={[
            { value: 'month', label: monthLabel },
            { value: 'all', label: t('netWorth.periodNames.all') },
          ]}
        />
        <Field label={t('movements.type')}>
          {(p) => (
            <Select {...p} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as Filters['type'], categoryId: '' })}>
              <option value="">{t('movements.allTypes')}</option>
              <option value="expense">{t('types.expense')}</option>
              <option value="income">{t('types.income')}</option>
              <option value="transfer">{t('types.transfer')}</option>
            </Select>
          )}
        </Field>
        {draft.type !== 'transfer' && (
          <Field label={t('movements.category')}>
            {(p) => (
              <Select {...p} value={draft.categoryId} onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}>
                <option value="">{t('movements.allCategories')}</option>
                {visibleCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {categoryLabel(c)}
                    {c.archived ? ` (${t('common.archived')})` : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label={t('movements.account')}>
          {(p) => (
            <Select {...p} value={draft.accountId} onChange={(e) => setDraft({ ...draft, accountId: e.target.value })}>
              <option value="">{t('movements.allAccounts')}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
    </Sheet>
  );
}
