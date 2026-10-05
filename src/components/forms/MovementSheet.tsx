'use client';

import { ArrowLeftRight, Repeat, Trash2, Wallet } from 'lucide-react';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useI18n } from '@/components/providers/I18nProvider';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, useErrorMessage } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useDeleteTransaction, useSaveTransaction, type TransactionPayload } from '@/hooks/api';
import { useFormat, useLookups } from '@/hooks/useFormat';
import { ApiClientError } from '@/lib/api-client';
import { centsToInput, parseAmountToCents, MAX_AMOUNT_CENTS } from '@/lib/money';
import type { BudgetAlert, TransactionDTO, TransactionType } from '@/lib/types';
import { AmountInput } from './AmountInput';
import { AccountPicker, CategoryPicker, DatePicker } from './Pickers';

const LAST_ACCOUNT_KEY = 'fin:last-account';

function omit(errors: Record<string, string>, key: string): Record<string, string> {
  const next = { ...errors };
  delete next[key];
  return next;
}

function readLastAccount(): string | null {
  try {
    return localStorage.getItem(LAST_ACCOUNT_KEY);
  } catch {
    return null;
  }
}

function rememberAccount(id: string) {
  try {
    localStorage.setItem(LAST_ACCOUNT_KEY, id);
  } catch {
    // storage unavailable (private mode) — not critical
  }
}

export function MovementSheet({
  open,
  initialType,
  transaction,
  onClose,
  onCreateAccount,
}: {
  open: boolean;
  initialType: TransactionType;
  transaction?: TransactionDTO;
  onClose: () => void;
  onCreateAccount: () => void;
}) {
  const { t, tDynamic, intlLocale } = useI18n();
  const f = useFormat();
  const { categories, accounts, categoryLabelById } = useLookups();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const save = useSaveTransaction();
  const remove = useDeleteTransaction();
  const amountRef = useRef<HTMLInputElement>(null);
  const editing = !!transaction;

  const usableAccounts = useMemo(
    () => accounts.filter((a) => !a.archived || a.id === transaction?.accountId || a.id === transaction?.toAccountId),
    [accounts, transaction],
  );
  const defaultAccount = useMemo(() => {
    const last = readLastAccount();
    return usableAccounts.find((a) => a.id === last && !a.archived)?.id ?? usableAccounts.find((a) => !a.archived)?.id ?? null;
  }, [usableAccounts]);

  const [type, setType] = useState<TransactionType>(transaction?.type ?? initialType);
  const [amount, setAmount] = useState(transaction ? centsToInput(transaction.amountCents, intlLocale) : '');
  const [categoryId, setCategoryId] = useState<string | null>(transaction?.categoryId ?? null);
  const [accountId, setAccountId] = useState<string | null>(transaction?.accountId ?? defaultAccount);
  const [toAccountId, setToAccountId] = useState<string | null>(transaction?.toAccountId ?? null);
  const [date, setDate] = useState(transaction?.date ?? f.today);
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [notes, setNotes] = useState(transaction?.notes ?? '');
  const [showNotes, setShowNotes] = useState(!!transaction?.notes);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const kindCategories = useMemo(
    () => (type === 'transfer' ? [] : categories.filter((c) => c.kind === type && (!c.archived || c.id === categoryId))),
    [categories, type, categoryId],
  );

  const changeType = (next: TransactionType) => {
    setType(next);
    setErrors({});
    const cat = categories.find((c) => c.id === categoryId);
    if (next === 'transfer' || (cat && cat.kind !== next)) setCategoryId(null);
    if (next === 'transfer' && toAccountId === accountId) setToAccountId(null);
  };

  const errorText = (code?: string) => (code ? tDynamic(`errors.${code}`, t('errors.invalid')) : undefined);

  function validate(): { payload: TransactionPayload } | null {
    const next: Record<string, string> = {};
    const cents = parseAmountToCents(amount);
    if (amount.trim() === '') next.amountCents = 'required';
    else if (cents === null) next.amountCents = 'amount_invalid';
    else if (cents <= 0) next.amountCents = 'amount_positive';
    else if (cents > MAX_AMOUNT_CENTS) next.amountCents = 'amount_too_large';
    if (!accountId) next.accountId = 'required';
    if (type === 'transfer') {
      if (!toAccountId) next.toAccountId = 'required';
      else if (toAccountId === accountId) next.toAccountId = 'same_account';
    } else if (!categoryId) next.categoryId = 'required';
    setErrors(next);
    if (Object.keys(next).length) return null;
    const base = { amountCents: cents as number, date, accountId: accountId as string, description: description.trim(), notes: notes.trim() || null };
    return {
      payload:
        type === 'transfer'
          ? { type, ...base, toAccountId: toAccountId as string }
          : { type, ...base, categoryId: categoryId as string },
    };
  }

  function announceBudgetAlerts(alerts: BudgetAlert[]) {
    for (const a of alerts) {
      const name = a.categoryId ? categoryLabelById(a.categoryId) : t('budget.overallName');
      toast.show(
        a.level === 'exceeded' ? t('budget.alertExceeded', { name, percent: a.percent }) : t('budget.alertWarning', { name, percent: a.percent }),
        'warning',
      );
    }
  }

  async function submit(addAnother: boolean) {
    setFormError(null);
    const result = validate();
    if (!result) return;
    try {
      const res = await save.mutateAsync({ id: transaction?.id, payload: result.payload });
      rememberAccount(result.payload.accountId);
      toast.show(editing ? t('movements.updated') : t('movements.saved'));
      announceBudgetAlerts(res.budgetAlerts);
      if (addAnother) {
        setAmount('');
        setDescription('');
        setNotes('');
        setShowNotes(false);
        setCategoryId(null);
        amountRef.current?.focus();
      } else onClose();
    } catch (error) {
      if (error instanceof ApiClientError && Object.keys(error.fields).length) setErrors(error.fields);
      setFormError(errorMessage(error));
    }
  }

  async function onDelete() {
    if (!transaction) return;
    try {
      await remove.mutateAsync(transaction.id);
      setConfirmDelete(false);
      toast.show(t('movements.deleted'));
      onClose();
    } catch (error) {
      setConfirmDelete(false);
      setFormError(errorMessage(error));
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit(false);
  };

  const noAccounts = usableAccounts.filter((a) => !a.archived).length === 0 && !editing;
  const formId = 'movement-form';

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={editing ? t('movements.editMovement') : t('movements.newMovement')}
        footer={
          noAccounts ? undefined : (
            <div className="flex gap-2">
              {editing ? (
                <Button
                  variant="danger"
                  size="square"
                  onClick={() => setConfirmDelete(true)}
                  aria-label={t('common.delete')}
                >
                  <Trash2 className="h-5 w-5" aria-hidden />
                </Button>
              ) : (
                <Button variant="soft" className="flex-1" onClick={() => void submit(true)} disabled={save.isPending}>
                  {t('form.saveAndNew')}
                </Button>
              )}
              <Button type="submit" form={formId} className="flex-1" loading={save.isPending}>
                {save.isPending ? t('common.saving') : t('common.save')}
              </Button>
            </div>
          )
        }
      >
        {noAccounts ? (
          <EmptyState
            icon={Wallet}
            title={t('form.noAccountsTitle')}
            text={t('form.noAccountsText')}
            action={
              <Button block onClick={onCreateAccount}>
                {t('form.createAccount')}
              </Button>
            }
          />
        ) : (
          <form id={formId} onSubmit={onSubmit} noValidate className="space-y-5 pt-1">
            <Segmented<TransactionType>
              label={t('movements.type')}
              value={type}
              onChange={changeType}
              options={[
                { value: 'expense', label: t('types.expense'), activeClassName: 'text-expense' },
                { value: 'income', label: t('types.income'), activeClassName: 'text-income' },
                { value: 'transfer', label: t('types.transfer'), activeClassName: 'text-transfer' },
              ]}
            />

            <div>
              <AmountInput
                ref={amountRef}
                label={t('form.amount')}
                value={amount}
                onChange={(v) => {
                  setAmount(v);
                  if (errors.amountCents) setErrors((e) => omit(e, 'amountCents'));
                }}
                tone={type}
                autoFocus={!editing}
                invalid={!!errors.amountCents}
                describedBy={errors.amountCents ? 'amount-error' : undefined}
              />
              {errors.amountCents && (
                <p id="amount-error" role="alert" className="mt-1.5 px-1 text-center text-sm text-danger">
                  {errorText(errors.amountCents)}
                </p>
              )}
            </div>

            {type === 'transfer' ? (
              <>
                {usableAccounts.length < 2 && (
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-transfer-soft p-3 text-sm text-transfer">
                    <span>{t('form.needTwoAccounts')}</span>
                    <Button size="sm" variant="secondary" onClick={onCreateAccount}>
                      {t('form.createAccount')}
                    </Button>
                  </div>
                )}
                <AccountPicker accounts={usableAccounts} value={accountId} onChange={setAccountId} label={t('form.fromAccount')} invalid={!!errors.accountId} />
                <div className="flex justify-center text-ink-4" aria-hidden>
                  <ArrowLeftRight className="h-5 w-5 rotate-90" />
                </div>
                <div>
                  <AccountPicker
                    accounts={usableAccounts}
                    value={toAccountId}
                    onChange={setToAccountId}
                    label={t('form.toAccount')}
                    exclude={accountId}
                    invalid={!!errors.toAccountId}
                  />
                  {errors.toAccountId && (
                    <p role="alert" className="mt-1.5 px-1 text-sm text-danger">
                      {errorText(errors.toAccountId)}
                    </p>
                  )}
                </div>
                <p className="rounded-2xl bg-surface-2 px-3 py-2.5 text-[13px] leading-snug text-ink-3">{t('form.transferHint')}</p>
              </>
            ) : (
              <>
                <div>
                  <CategoryPicker
                    categories={kindCategories}
                    value={categoryId}
                    onChange={(id) => {
                      setCategoryId(id);
                      if (errors.categoryId) setErrors((e) => omit(e, 'categoryId'));
                    }}
                    label={t('form.category')}
                    invalid={!!errors.categoryId}
                  />
                  {errors.categoryId && (
                    <p role="alert" className="mt-1.5 px-1 text-sm text-danger">
                      {errorText(errors.categoryId)}
                    </p>
                  )}
                </div>
                <div>
                  <AccountPicker accounts={usableAccounts} value={accountId} onChange={setAccountId} label={t('form.account')} invalid={!!errors.accountId} />
                  {errors.accountId && (
                    <p role="alert" className="mt-1.5 px-1 text-sm text-danger">
                      {errorText(errors.accountId)}
                    </p>
                  )}
                </div>
              </>
            )}

            <DatePicker value={date} onChange={setDate} label={t('form.date')} />

            <Field label={t('form.description')} optional={t('common.optional')} error={errorText(errors.description)}>
              {(p) => (
                <Input
                  {...p}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('form.descriptionPlaceholder')}
                  maxLength={120}
                  enterKeyHint="done"
                  autoComplete="off"
                />
              )}
            </Field>

            {showNotes ? (
              <Field label={t('form.notes')} optional={t('common.optional')} error={errorText(errors.notes)}>
                {(p) => <Textarea {...p} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('form.notesPlaceholder')} maxLength={500} rows={3} />}
              </Field>
            ) : (
              <button type="button" onClick={() => setShowNotes(true)} className="h-11 px-1 text-[15px] font-semibold text-brand">
                + {t('form.addNotes')}
              </button>
            )}

            {transaction?.recurringId && (
              <p className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2.5 text-[13px] text-ink-3">
                <Repeat className="h-4 w-4 shrink-0" aria-hidden />
                {t('movements.generatedByRule')}
              </p>
            )}

            {formError && (
              <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
                {formError}
              </p>
            )}
          </form>
        )}
      </Sheet>
      <ConfirmDialog
        open={confirmDelete}
        title={t('movements.deleteConfirmTitle')}
        description={t('movements.deleteConfirmText')}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void onDelete()}
        loading={remove.isPending}
      />
    </>
  );
}
