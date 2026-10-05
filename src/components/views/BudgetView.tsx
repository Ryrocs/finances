'use client';

import { CircleCheck, Pencil, Plus, Target, Trash2, TriangleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { AmountInput } from '@/components/forms/AmountInput';
import { useI18n } from '@/components/providers/I18nProvider';
import { MonthSwitcher } from '@/components/shell/MonthSwitcher';
import { useMonth } from '@/components/shell/MonthContext';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, SectionTitle } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Select } from '@/components/ui/Field';
import { CategoryBadge } from '@/components/ui/icons';
import { Sheet } from '@/components/ui/Sheet';
import { Badge, EmptyState, ErrorState, PageSkeleton, ProgressBar, useErrorMessage } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useBudgets, useDeleteBudget, useSaveBudget } from '@/hooks/api';
import { useFormat, useLookups } from '@/hooks/useFormat';
import { dailyAllowance } from '@/lib/finance/budget';
import { centsToInput, parseAmountToCents } from '@/lib/money';
import type { BudgetOverviewDTO, BudgetStatusDTO } from '@/lib/types';
import { DemoBanner } from './DemoBanner';

type Editing = { open: false } | { open: true; categoryId: string | null; budget?: BudgetStatusDTO; key: number };

export function BudgetView() {
  const { t } = useI18n();
  const { month } = useMonth();
  const query = useBudgets(month);
  const [editing, setEditing] = useState<Editing>({ open: false });
  const open = (categoryId: string | null, budget?: BudgetStatusDTO) => setEditing({ open: true, categoryId, budget, key: Date.now() });

  return (
    <>
      <PageHeader title={t('budget.title')} />
      <DemoBanner />
      <div className="space-y-4">
        <MonthSwitcher className="lg:max-w-sm" />
        {query.isPending ? (
          <PageSkeleton cards={2} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : (
          <BudgetContent overview={query.data.overview} onEdit={open} />
        )}
      </div>
      <BudgetSheet
        key={editing.open ? editing.key : 'closed'}
        open={editing.open}
        categoryId={editing.open ? editing.categoryId : null}
        budget={editing.open ? editing.budget : undefined}
        usedCategoryIds={query.data?.budgets.map((b) => b.categoryId).filter((id): id is string => !!id) ?? []}
        onClose={() => setEditing({ open: false })}
      />
    </>
  );
}

function BudgetContent({ overview, onEdit }: { overview: BudgetOverviewDTO; onEdit: (categoryId: string | null, budget?: BudgetStatusDTO) => void }) {
  const { t } = useI18n();
  const f = useFormat();
  const { categories, categoryLabelById, category } = useLookups();
  const hasAny = overview.overall || overview.categories.length > 0;
  const free = categories.filter((c) => c.kind === 'expense' && !c.archived && !overview.categories.some((b) => b.categoryId === c.id));

  if (!hasAny) {
    return (
      <Card>
        <EmptyState
          icon={Target}
          title={t('budget.emptyTitle')}
          text={t('budget.emptyText')}
          action={
            <>
              <Button onClick={() => onEdit(null)}>{t('budget.setOverall')}</Button>
              <Button variant="soft" onClick={() => onEdit(free[0]?.id ?? null)} disabled={!free.length}>
                {t('budget.addBudget')}
              </Button>
            </>
          }
        />
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div>
        {overview.overall ? (
          <OverallCard status={overview.overall} overview={overview} onEdit={() => onEdit(null, overview.overall ?? undefined)} />
        ) : (
          <Card>
            <p className="text-[15px] text-ink-2">{t('budget.emptyText')}</p>
            <Button className="mt-3" variant="soft" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => onEdit(null)}>
              {t('budget.setOverall')}
            </Button>
          </Card>
        )}
        <p className="mt-3 px-1 text-[13px] text-ink-3">{t('budget.neverBlocks')}</p>
      </div>

      <div>
        <SectionTitle
          action={
            free.length > 0 && (
              <Button variant="link" size="sm" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => onEdit(free[0].id)}>
                {t('common.add')}
              </Button>
            )
          }
        >
          {t('budget.categoryBudgets')}
        </SectionTitle>
        {overview.categories.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-3">{t('budget.emptyText')}</p>
          </Card>
        ) : (
          <Card className="p-2 sm:p-2">
            <ul>
              {overview.categories.map((b) => (
                <li key={b.id}>
                  <button type="button" onClick={() => onEdit(b.categoryId, b)} className="flex w-full items-start gap-3 rounded-2xl px-2 py-3 text-left hover:bg-surface-2">
                    <CategoryBadge category={category(b.categoryId)} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[15px] font-semibold text-ink">{categoryLabelById(b.categoryId)}</span>
                        <LevelBadge status={b} />
                      </span>
                      <span className="mt-0.5 block text-[13px] text-ink-3 tabular">
                        {t('budget.spentOf', { spent: f.money(b.spentCents), budget: f.money(b.budgetCents) })} · {b.percent} %
                      </span>
                      <span className="mt-2 block">
                        <ProgressBar value={b.percent} level={b.level} label={categoryLabelById(b.categoryId)} />
                      </span>
                      <span className={cn('mt-1.5 block text-[13px] font-medium tabular', b.level === 'exceeded' ? 'text-danger' : 'text-ink-2')}>
                        {b.remainingCents >= 0 ? t('budget.remaining', { amount: f.money(b.remainingCents) }) : t('budget.exceededBy', { amount: f.money(-b.remainingCents) })}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {overview.unbudgetedSpentCents > 0 && (
          <p className="mt-3 flex justify-between gap-3 px-1 text-[13px] text-ink-3">
            <span>{t('budget.unbudgeted')}</span>
            <span className="font-semibold text-ink-2 tabular">{f.money(overview.unbudgetedSpentCents)}</span>
          </p>
        )}
      </div>
    </div>
  );
}

function LevelBadge({ status }: { status: BudgetStatusDTO }) {
  const { t } = useI18n();
  if (status.level === 'exceeded')
    return (
      <Badge tone="danger">
        <TriangleAlert className="h-3 w-3" aria-hidden />
        {t('budget.exceeded')}
      </Badge>
    );
  if (status.level === 'warning')
    return (
      <Badge tone="warning">
        <TriangleAlert className="h-3 w-3" aria-hidden />
        {t('budget.warning')}
      </Badge>
    );
  return (
    <Badge tone="brand">
      <CircleCheck className="h-3 w-3" aria-hidden />
      {t('budget.ok')}
    </Badge>
  );
}

function OverallCard({ status, overview, onEdit }: { status: BudgetStatusDTO; overview: BudgetOverviewDTO; onEdit: () => void }) {
  const { t } = useI18n();
  const f = useFormat();
  const perDay = dailyAllowance(status.remainingCents, overview.daysLeft);
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-ink">{t('budget.overall')}</p>
          <p className="mt-0.5 text-[13px] text-ink-3">{f.month(overview.month)}</p>
        </div>
        <Button variant="soft" size="icon" onClick={onEdit} aria-label={t('budget.editBudget')}>
          <Pencil className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      <p className={cn('mt-3 text-[28px] font-bold leading-tight tracking-tight tabular', status.level === 'exceeded' && 'text-danger')}>
        {status.remainingCents >= 0
          ? t('budget.remaining', { amount: f.money(status.remainingCents) })
          : t('budget.exceededBy', { amount: f.money(-status.remainingCents) })}
      </p>
      <div className="mt-4">
        <ProgressBar value={status.percent} level={status.level} label={t('budget.overall')} />
        <div className="mt-1.5 flex justify-between text-[13px] text-ink-3 tabular">
          <span>{t('budget.spentOf', { spent: f.money(status.spentCents), budget: f.money(status.budgetCents) })}</span>
          <span className={cn('font-semibold', status.level === 'exceeded' ? 'text-danger' : status.level === 'warning' ? 'text-warning' : 'text-ink-2')}>{status.percent} %</span>
        </div>
      </div>
      <div className="mt-3">
        <LevelBadge status={status} />
      </div>
      {overview.daysLeft > 0 && (
        <p className="mt-3 text-[14px] leading-snug text-ink-2">
          {perDay > 0 ? t('budget.perDayLeft', { amount: f.money(perDay), days: overview.daysLeft }) : t('budget.nothingLeft')}
        </p>
      )}
    </Card>
  );
}

function BudgetSheet({
  open,
  categoryId: initialCategory,
  budget,
  usedCategoryIds,
  onClose,
}: {
  open: boolean;
  categoryId: string | null;
  budget?: BudgetStatusDTO;
  usedCategoryIds: string[];
  onClose: () => void;
}) {
  const { t, tDynamic, intlLocale } = useI18n();
  const { categories, categoryLabel } = useLookups();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const save = useSaveBudget();
  const remove = useDeleteBudget();
  const editing = !!budget;
  const [categoryId, setCategoryId] = useState<string | null>(initialCategory);
  const [amount, setAmount] = useState(budget ? centsToInput(budget.budgetCents, intlLocale) : '');
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const isOverall = initialCategory === null && (editing || categoryId === null);
  const options = categories.filter((c) => c.kind === 'expense' && !c.archived && (!usedCategoryIds.includes(c.id) || c.id === initialCategory));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const cents = parseAmountToCents(amount);
    if (amount.trim() === '') return setError('required');
    if (cents === null) return setError('amount_invalid');
    if (cents <= 0) return setError('amount_positive');
    setError(null);
    try {
      await save.mutateAsync({ categoryId, amountCents: cents });
      toast.show(t('budget.saved'));
      onClose();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  }

  async function onDelete() {
    if (!budget) return;
    try {
      await remove.mutateAsync(budget.id);
      toast.show(t('budget.deleted'));
      setConfirm(false);
      onClose();
    } catch (err) {
      setConfirm(false);
      setFormError(errorMessage(err));
    }
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={editing ? t('budget.editBudget') : t('budget.newBudget')}
        footer={
          <div className="flex gap-2">
            {editing && (
              <Button variant="danger" size="square" onClick={() => setConfirm(true)} aria-label={t('common.delete')}>
                <Trash2 className="h-5 w-5" aria-hidden />
              </Button>
            )}
            <Button type="submit" form="budget-form" className="flex-1" loading={save.isPending}>
              {t('common.save')}
            </Button>
          </div>
        }
      >
        <form id="budget-form" onSubmit={onSubmit} noValidate className="space-y-5 pt-1">
          {isOverall ? (
            <p className="text-[15px] font-semibold text-ink">{t('budget.overall')}</p>
          ) : editing ? (
            <p className="text-[15px] font-semibold text-ink">{categoryLabel(categories.find((c) => c.id === categoryId))}</p>
          ) : (
            <Field label={t('form.category')}>
              {(p) => (
                <Select {...p} value={categoryId ?? ''} onChange={(e) => setCategoryId(e.target.value || null)}>
                  {options.map((c) => (
                    <option key={c.id} value={c.id}>
                      {categoryLabel(c)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <div>
            <p className="mb-2 px-1 text-sm font-medium text-ink-2">{t('budget.amount')}</p>
            <AmountInput label={t('budget.amount')} value={amount} onChange={setAmount} autoFocus invalid={!!error} />
            {error && (
              <p role="alert" className="mt-1.5 px-1 text-center text-sm text-danger">
                {tDynamic(`errors.${error}`)}
              </p>
            )}
          </div>
          <p className="text-[13px] text-ink-3">{t('budget.neverBlocks')}</p>
          {formError && (
            <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
              {formError}
            </p>
          )}
        </form>
      </Sheet>
      <ConfirmDialog
        open={confirm}
        title={t('budget.deleteConfirmTitle')}
        description={t('budget.deleteConfirmText')}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void onDelete()}
        loading={remove.isPending}
      />
    </>
  );
}
