'use client';

import { ArrowLeftRight, Plus, Repeat, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { AmountInput } from '@/components/forms/AmountInput';
import { AccountPicker, CategoryPicker } from '@/components/forms/Pickers';
import { useI18n } from '@/components/providers/I18nProvider';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Select, Switch } from '@/components/ui/Field';
import { CategoryBadge, IconBadge } from '@/components/ui/icons';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { Badge, EmptyState, ErrorState, Skeleton, useErrorMessage } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useDeleteRecurring, useRecurring, useSaveRecurring, type RecurringPayload } from '@/hooks/api';
import { useFormat, useLookups } from '@/hooks/useFormat';
import { ApiClientError } from '@/lib/api-client';
import { isValidISODate } from '@/lib/dates';
import { centsToInput, parseAmountToCents } from '@/lib/money';
import type { Frequency, RecurringDTO, TransactionType } from '@/lib/types';

type Editing = { open: false } | { open: true; rule?: RecurringDTO; key: number };

export function RecurringView() {
  const { t, tp } = useI18n();
  const f = useFormat();
  const { category, categoryLabelById, accountName } = useLookups();
  const query = useRecurring();
  const [editing, setEditing] = useState<Editing>({ open: false });

  return (
    <>
      <PageHeader
        title={t('recurring.title')}
        backHref="/settings"
        showSettings={false}
        actions={
          <Button size="sm" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setEditing({ open: true, key: Date.now() })}>
            {t('common.add')}
          </Button>
        }
      />
      <div className="mx-auto max-w-2xl">
        {query.isPending ? (
          <Card className="space-y-3">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </Card>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : query.data.length === 0 ? (
          <Card>
            <EmptyState
              icon={Repeat}
              title={t('recurring.emptyTitle')}
              text={t('recurring.emptyText')}
              action={<Button onClick={() => setEditing({ open: true, key: Date.now() })}>{t('recurring.add')}</Button>}
            />
          </Card>
        ) : (
          <Card className="p-2 sm:p-2">
            <ul>
              {query.data.map((r) => {
                const title = r.description || (r.type === 'transfer' ? t('types.transfer') : categoryLabelById(r.categoryId));
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setEditing({ open: true, rule: r, key: Date.now() })}
                      className={cn('flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-surface-2', !r.isActive && 'opacity-60')}
                    >
                      {r.type === 'transfer' ? <IconBadge icon={ArrowLeftRight} color="#2563eb" /> : <CategoryBadge category={category(r.categoryId)} />}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[15px] font-semibold text-ink">{title}</span>
                          {r.isDemo && <Badge>{t('common.demo')}</Badge>}
                        </span>
                        <span className="block truncate text-[13px] text-ink-3">
                          {tp(`recurring.every.${r.frequency}`, r.interval)} · {r.type === 'transfer' ? t('movements.transferLabel', { from: accountName(r.accountId), to: accountName(r.toAccountId) }) : accountName(r.accountId)}
                        </span>
                        <span className="block truncate text-[12px] text-ink-4">
                          {!r.isActive ? t('recurring.paused') : r.nextDate ? t('recurring.nextDate', { date: f.date(r.nextDate, 'medium') }) : t('recurring.ended')}
                        </span>
                      </span>
                      <span className={cn('shrink-0 text-[15px] font-semibold tabular', r.type === 'income' ? 'text-income' : r.type === 'transfer' ? 'text-transfer' : 'text-ink')}>
                        {r.type === 'expense' ? f.money(-r.amountCents) : r.type === 'income' ? f.money(r.amountCents, { signed: true }) : f.money(r.amountCents)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
      <RecurringSheet
        key={editing.open ? editing.key : 'closed'}
        open={editing.open}
        rule={editing.open ? editing.rule : undefined}
        onClose={() => setEditing({ open: false })}
      />
    </>
  );
}

function RecurringSheet({ open, rule, onClose }: { open: boolean; rule?: RecurringDTO; onClose: () => void }) {
  const { t, tDynamic, intlLocale } = useI18n();
  const f = useFormat();
  const { categories, accounts } = useLookups();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const save = useSaveRecurring();
  const remove = useDeleteRecurring();
  const editing = !!rule;
  const usable = useMemo(() => accounts.filter((a) => !a.archived || a.id === rule?.accountId || a.id === rule?.toAccountId), [accounts, rule]);

  const [type, setType] = useState<TransactionType>(rule?.type ?? 'expense');
  const [amount, setAmount] = useState(rule ? centsToInput(rule.amountCents, intlLocale) : '');
  const [categoryId, setCategoryId] = useState<string | null>(rule?.categoryId ?? null);
  const [accountId, setAccountId] = useState<string | null>(rule?.accountId ?? usable[0]?.id ?? null);
  const [toAccountId, setToAccountId] = useState<string | null>(rule?.toAccountId ?? null);
  const [frequency, setFrequency] = useState<Frequency>(rule?.frequency ?? 'monthly');
  const [interval, setInterval] = useState(rule?.interval ?? 1);
  const [startDate, setStartDate] = useState(rule?.startDate ?? f.today);
  const [endDate, setEndDate] = useState(rule?.endDate ?? '');
  const [isActive, setIsActive] = useState(rule?.isActive ?? true);
  const [description, setDescription] = useState(rule?.description ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const kindCategories = categories.filter((c) => type !== 'transfer' && c.kind === type && (!c.archived || c.id === categoryId));
  const err = (k: string) => (errors[k] ? tDynamic(`errors.${errors[k]}`, t('errors.invalid')) : undefined);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next: Record<string, string> = {};
    const cents = parseAmountToCents(amount);
    if (!amount.trim()) next.amountCents = 'required';
    else if (cents === null) next.amountCents = 'amount_invalid';
    else if (cents <= 0) next.amountCents = 'amount_positive';
    if (!accountId) next.accountId = 'required';
    if (type === 'transfer') {
      if (!toAccountId) next.toAccountId = 'required';
      else if (toAccountId === accountId) next.toAccountId = 'same_account';
    } else if (!categoryId) next.categoryId = 'required';
    if (!isValidISODate(startDate)) next.startDate = 'invalid_date';
    if (endDate && (!isValidISODate(endDate) || endDate < startDate)) next.endDate = 'end_before_start';
    setErrors(next);
    if (Object.keys(next).length) return;

    const base = {
      amountCents: cents as number,
      accountId: accountId as string,
      description: description.trim(),
      notes: null,
      frequency,
      interval,
      startDate,
      endDate: endDate || null,
      isActive,
    };
    const payload: RecurringPayload =
      type === 'transfer' ? { type, ...base, toAccountId: toAccountId as string } : { type, ...base, categoryId: categoryId as string };
    try {
      await save.mutateAsync({ id: rule?.id, payload });
      toast.show(t('recurring.saved'));
      onClose();
    } catch (error) {
      if (error instanceof ApiClientError) setErrors(error.fields);
      setFormError(errorMessage(error));
    }
  }

  async function onDelete() {
    if (!rule) return;
    try {
      await remove.mutateAsync(rule.id);
      toast.show(t('recurring.deleted'));
      setConfirm(false);
      onClose();
    } catch (error) {
      setConfirm(false);
      setFormError(errorMessage(error));
    }
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={editing ? t('recurring.edit') : t('recurring.add')}
        footer={
          <div className="flex gap-2">
            {editing && (
              <Button variant="danger" size="square" onClick={() => setConfirm(true)} aria-label={t('common.delete')}>
                <Trash2 className="h-5 w-5" aria-hidden />
              </Button>
            )}
            <Button type="submit" form="recurring-form" className="flex-1" loading={save.isPending}>
              {t('common.save')}
            </Button>
          </div>
        }
      >
        <form id="recurring-form" onSubmit={submit} noValidate className="space-y-5 pt-1">
          <Segmented<TransactionType>
            label={t('movements.type')}
            value={type}
            onChange={(v) => {
              setType(v);
              setCategoryId(null);
            }}
            options={[
              { value: 'expense', label: t('types.expense'), activeClassName: 'text-expense' },
              { value: 'income', label: t('types.income'), activeClassName: 'text-income' },
              { value: 'transfer', label: t('types.transfer'), activeClassName: 'text-transfer' },
            ]}
          />
          <div>
            <AmountInput label={t('form.amount')} value={amount} onChange={setAmount} tone={type} invalid={!!errors.amountCents} />
            {errors.amountCents && (
              <p role="alert" className="mt-1.5 text-center text-sm text-danger">
                {err('amountCents')}
              </p>
            )}
          </div>
          {type === 'transfer' ? (
            <>
              <AccountPicker accounts={usable} value={accountId} onChange={setAccountId} label={t('form.fromAccount')} invalid={!!errors.accountId} />
              <AccountPicker accounts={usable} value={toAccountId} onChange={setToAccountId} label={t('form.toAccount')} exclude={accountId} invalid={!!errors.toAccountId} />
              {errors.toAccountId && <p className="text-sm text-danger">{err('toAccountId')}</p>}
            </>
          ) : (
            <>
              <CategoryPicker categories={kindCategories} value={categoryId} onChange={setCategoryId} label={t('form.category')} invalid={!!errors.categoryId} />
              {errors.categoryId && <p className="text-sm text-danger">{err('categoryId')}</p>}
              <AccountPicker accounts={usable} value={accountId} onChange={setAccountId} label={t('form.account')} invalid={!!errors.accountId} />
            </>
          )}
          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <Field label={t('recurring.frequency')}>
              {(p) => (
                <Select {...p} value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
                  <option value="weekly">{t('recurring.weekly')}</option>
                  <option value="monthly">{t('recurring.monthly')}</option>
                  <option value="yearly">{t('recurring.yearly')}</option>
                </Select>
              )}
            </Field>
            <Field label={t('recurring.interval')}>
              {(p) => (
                <Select {...p} value={interval} onChange={(e) => setInterval(Number(e.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('recurring.startDate')} error={err('startDate')} hint={!editing && startDate < f.today ? t('recurring.pastNote') : undefined}>
              {(p) => <Input {...p} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />}
            </Field>
            <Field label={t('recurring.endDate')} optional={t('recurring.noEnd')} error={err('endDate')}>
              {(p) => <Input {...p} type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />}
            </Field>
          </div>
          <Field label={t('form.description')} optional={t('common.optional')}>
            {(p) => <Input {...p} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('form.descriptionPlaceholder')} maxLength={120} />}
          </Field>
          <Switch checked={isActive} onChange={setIsActive} label={isActive ? t('recurring.active') : t('recurring.paused')} />
          {formError && (
            <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
              {formError}
            </p>
          )}
        </form>
      </Sheet>
      <ConfirmDialog
        open={confirm}
        title={t('recurring.deleteConfirmTitle')}
        description={t('recurring.deleteConfirmText')}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void onDelete()}
        loading={remove.isPending}
      />
    </>
  );
}
