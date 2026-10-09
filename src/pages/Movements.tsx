import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { MonthSelector } from '../components/MonthSelector';
import { MovementRow } from '../components/MovementRow';
import { PageHeader } from '../components/PageHeader';
import { DateField } from '../components/forms/DateField';
import { useSheets } from '../components/sheets/SheetsProvider';
import { FitAmount } from '../components/ui/Amount';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { cn } from '../components/ui/cn';
import { EmptyState } from '../components/ui/EmptyState';
import { Field, Select, useFieldId } from '../components/ui/Field';
import { Segmented } from '../components/ui/Segmented';
import { Sheet } from '../components/ui/Sheet';
import { formatDayHeader, formatShortDate, type ISODate } from '../lib/dates';
import { filterMovements, type MovementFilters } from '../lib/filters';
import { flowTotals } from '../lib/finance/cashflow';
import type { Transaction, TransactionType } from '../lib/types';
import { useAppState } from '../state/app';
import { useStore } from '../state/data';
import { T } from '../texts';

const m = T.movements;

const PARAMS = { type: 'tipus', categoryId: 'categoria', accountId: 'compte', from: 'des', to: 'fins', query: 'q' } as const;

function readFilters(params: URLSearchParams): MovementFilters {
  const type = params.get(PARAMS.type);
  return {
    type: type === 'expense' || type === 'income' || type === 'transfer' ? type : undefined,
    categoryId: params.get(PARAMS.categoryId) ?? undefined,
    accountId: params.get(PARAMS.accountId) ?? undefined,
    from: params.get(PARAMS.from) ?? undefined,
    to: params.get(PARAMS.to) ?? undefined,
    query: params.get(PARAMS.query) ?? undefined,
  };
}

export function MovementsPage() {
  const store = useStore();
  const { month } = useAppState();
  const { openDetail } = useSheets();
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const [showFilters, setShowFilters] = useState(false);

  const setFilters = (next: MovementFilters) => {
    const p = new URLSearchParams();
    for (const [key, name] of Object.entries(PARAMS) as Array<[keyof MovementFilters, string]>) {
      const value = next[key];
      if (value) p.set(name, value);
    }
    setParams(p, { replace: true });
  };

  const visible = useMemo(() => filterMovements(store.transactions, month, filters), [store.transactions, month, filters.type, filters.categoryId, filters.accountId, filters.from, filters.to, filters.query]); // eslint-disable-line react-hooks/exhaustive-deps
  const totals = useMemo(() => flowTotals(visible), [visible]);
  const groups = useMemo(() => {
    const out: Array<{ date: ISODate; items: Transaction[] }> = [];
    for (const tx of visible) {
      const last = out[out.length - 1];
      if (last && last.date === tx.date) last.items.push(tx);
      else out.push({ date: tx.date, items: [tx] });
    }
    return out;
  }, [visible]);

  const rangeActive = !!(filters.from || filters.to);
  const chips: Array<{ key: keyof MovementFilters | 'range'; label: string }> = [];
  if (filters.type) chips.push({ key: 'type', label: T.types[filters.type] });
  if (filters.categoryId) {
    const c = store.categoryById.get(filters.categoryId);
    chips.push({ key: 'categoryId', label: c ? `${c.emoji} ${c.name}` : '—' });
  }
  if (filters.accountId) chips.push({ key: 'accountId', label: store.accountById.get(filters.accountId)?.name ?? '—' });
  if (rangeActive) {
    const year = Number(month.slice(0, 4));
    const label =
      filters.from && filters.to
        ? m.rangeChip(formatShortDate(filters.from, year), formatShortDate(filters.to, year))
        : filters.from
          ? m.rangeFromChip(formatShortDate(filters.from, year))
          : m.rangeToChip(formatShortDate(filters.to!, year));
    chips.push({ key: 'range', label });
  }
  const filtering = chips.length > 0 || !!filters.query;
  const year = Number(month.slice(0, 4));

  return (
    <>
      <PageHeader title={m.title} />
      <div className="space-y-3">
        <MonthSelector disabled={rangeActive} />
        {rangeActive && <p className="px-1 text-[13px] text-ink-3">{m.rangeActive}</p>}
        <div className="flex gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">{m.search}</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-4" aria-hidden />
            <input
              type="search"
              value={filters.query ?? ''}
              onChange={(e) => setFilters({ ...filters, query: e.target.value || undefined })}
              placeholder={m.searchPlaceholder}
              aria-label={m.search}
              enterKeyHint="search"
              className="h-12 w-full min-w-0 rounded-xl border border-line-strong bg-surface pl-11 pr-10 text-[16px] outline-none placeholder:text-ink-4 focus:border-ink-3 [&::-webkit-search-cancel-button]:hidden"
            />
            {filters.query && (
              <button
                type="button"
                aria-label={m.clearSearch}
                onClick={() => setFilters({ ...filters, query: undefined })}
                className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-ink-3"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
          </label>
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            data-testid="open-filters"
            className={cn(
              'flex h-12 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-[15px] font-semibold',
              chips.length ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink',
            )}
          >
            <SlidersHorizontal className="h-[18px] w-[18px]" aria-hidden />
            {m.filters}
            {chips.length > 0 && <span className="rounded-full bg-white px-1.5 text-[12px] font-bold text-ink">{chips.length}</span>}
          </button>
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setFilters(chip.key === 'range' ? { ...filters, from: undefined, to: undefined } : { ...filters, [chip.key]: undefined })}
                aria-label={m.removeFilter(chip.label)}
                className="inline-flex h-11 max-w-full items-center gap-1.5 rounded-full bg-soft-2 pl-3.5 pr-2.5 text-[14px] font-medium text-ink"
              >
                <span className="truncate">{chip.label}</span>
                <X className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3" data-testid="movements-summary">
          <Card className="px-4 py-3">
            <p className="text-[13px] text-ink-3">{T.common.income}</p>
            <FitAmount cents={totals.incomeCents} options={{ signed: true }} className="text-[18px] font-bold text-income-ink" testId="summary-income" />
          </Card>
          <Card className="px-4 py-3">
            <p className="text-[13px] text-ink-3">{T.common.expenses}</p>
            <FitAmount cents={-totals.expenseCents} className="text-[18px] font-bold text-expense-ink" testId="summary-expenses" />
          </Card>
        </div>

        {groups.length === 0 ? (
          <Card>
            <EmptyState icon="🧾" title={filtering ? m.noMatches : m.empty} hint={filtering ? undefined : m.emptyHint} />
          </Card>
        ) : (
          <div className="space-y-4 pt-1">
            {groups.map((g) => (
              <section key={g.date}>
                <h2 className="mb-1.5 px-1 text-[13px] font-semibold text-ink-3">
                  {formatDayHeader(g.date)}
                  {rangeActive && Number(g.date.slice(0, 4)) !== year ? ` ${g.date.slice(0, 4)}` : ''}
                </h2>
                <Card className="overflow-hidden p-0">
                  <ul className="divide-y divide-line">
                    {g.items.map((tx) => (
                      <MovementRow key={tx.id} tx={tx} store={store} onSelect={openDetail} />
                    ))}
                  </ul>
                </Card>
              </section>
            ))}
          </div>
        )}
      </div>

      {showFilters && <FiltersSheet initial={filters} onClose={() => setShowFilters(false)} onApply={(f) => setFilters({ ...f, query: filters.query })} />}
    </>
  );
}

function FiltersSheet({ initial, onClose, onApply }: { initial: MovementFilters; onClose: () => void; onApply: (f: MovementFilters) => void }) {
  const store = useStore();
  const { today } = useAppState();
  const [draft, setDraft] = useState<MovementFilters>(initial);
  const categoryId = useFieldId('filter-category');
  const accountId = useFieldId('filter-account');
  const kinds = draft.type === 'income' ? ['income'] : draft.type === 'expense' ? ['expense'] : ['expense', 'income'];
  const categories = store.categories.filter((c) => kinds.includes(c.kind));

  return (
    <Sheet
      open
      onClose={onClose}
      title={m.filters}
      testId="filters-sheet"
      footer={
        <div className="flex gap-3">
          <Button
            variant="secondary"
            block
            onClick={() => {
              onApply({});
              onClose();
            }}
          >
            {m.clearFilters}
          </Button>
          <Button
            block
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            {m.showResults}
          </Button>
        </div>
      }
    >
      <div className="space-y-5 pb-2">
        <Field label={m.type}>
          <Segmented
            label={m.type}
            size="sm"
            value={draft.type ?? 'all'}
            options={[
              { value: 'all', label: m.allTypes },
              { value: 'expense', label: T.types.expense },
              { value: 'income', label: T.types.income },
              { value: 'transfer', label: T.types.transfer },
            ]}
            onChange={(v) => {
              const type = v === 'all' ? undefined : (v as TransactionType);
              const keep = draft.categoryId && type !== 'transfer' && (!type || store.categoryById.get(draft.categoryId)?.kind === type);
              setDraft({ ...draft, type, categoryId: keep ? draft.categoryId : undefined });
            }}
          />
        </Field>
        {draft.type !== 'transfer' && (
          <Field label={m.category} htmlFor={categoryId}>
            <Select id={categoryId} value={draft.categoryId ?? ''} onChange={(e) => setDraft({ ...draft, categoryId: e.target.value || undefined })}>
              <option value="">{m.allCategories}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label={m.account} htmlFor={accountId}>
          <Select id={accountId} value={draft.accountId ?? ''} onChange={(e) => setDraft({ ...draft, accountId: e.target.value || undefined })}>
            <option value="">{m.allAccounts}</option>
            {store.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <div>
          <p className="mb-2 text-[14px] font-semibold text-ink">{m.dateRange}</p>
          <div className="space-y-3">
            <OptionalDate label={m.from} value={draft.from} today={today} onChange={(from) => setDraft({ ...draft, from })} />
            <OptionalDate label={m.to} value={draft.to} today={today} onChange={(to) => setDraft({ ...draft, to })} />
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function OptionalDate({ label, value, today, onChange }: { label: string; value?: string; today: string; onChange: (v?: string) => void }) {
  if (!value) {
    return (
      <Field label={label}>
        <button
          type="button"
          onClick={() => onChange(today)}
          className="flex h-12 w-full items-center rounded-xl border border-dashed border-line-strong px-3.5 text-left text-[16px] text-ink-4"
        >
          {m.pickDate}
        </button>
      </Field>
    );
  }
  return (
    <div className="flex items-end gap-2">
      <div className="min-w-0 flex-1">
        <DateField label={label} value={value} onChange={onChange} today={today} shortcuts={false} />
      </div>
      <button type="button" onClick={() => onChange(undefined)} aria-label={`${T.common.remove}: ${label}`} className="flex h-12 w-12 items-center justify-center rounded-xl bg-soft text-ink-3">
        <X className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}
