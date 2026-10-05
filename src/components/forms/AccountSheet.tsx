'use client';

import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { useI18n } from '@/components/providers/I18nProvider';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { cn } from '@/components/ui/cn';
import { Field, Input, Switch } from '@/components/ui/Field';
import { IconBadge, accountIcon } from '@/components/ui/icons';
import { Sheet } from '@/components/ui/Sheet';
import { useErrorMessage } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useDeleteAccount, useSaveAccount } from '@/hooks/api';
import { useFormat } from '@/hooks/useFormat';
import { ApiClientError } from '@/lib/api-client';
import { ACCOUNT_COLORS } from '@/lib/categories';
import { isValidISODate } from '@/lib/dates';
import { centsToInput, parseAmountToCents } from '@/lib/money';
import { ACCOUNT_TYPES, type AccountDTO, type AccountType } from '@/lib/types';
import { AmountInput } from './AmountInput';

export function AccountSheet({ open, account, onClose }: { open: boolean; account?: AccountDTO; onClose: () => void }) {
  const { t, tDynamic, tp, intlLocale } = useI18n();
  const f = useFormat();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const save = useSaveAccount();
  const remove = useDeleteAccount();
  const typeName = useId();
  const editing = !!account;

  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'checking');
  const [balance, setBalance] = useState(account ? centsToInput(account.initialBalanceCents, intlLocale) : '');
  const [balanceDate, setBalanceDate] = useState(account?.initialBalanceDate ?? f.today);
  const [isLiquid, setIsLiquid] = useState(account?.isLiquid ?? true);
  const [color, setColor] = useState(account?.color ?? ACCOUNT_COLORS[0]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const err = (code?: string) => (code ? tDynamic(`errors.${code}`, t('errors.invalid')) : undefined);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'required';
    const cents = balance.trim() === '' ? 0 : parseAmountToCents(balance, { allowNegative: true });
    if (cents === null) next.initialBalanceCents = 'amount_invalid';
    if (!isValidISODate(balanceDate)) next.initialBalanceDate = 'invalid_date';
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await save.mutateAsync({
        id: account?.id,
        payload: { name: name.trim(), type, initialBalanceCents: cents as number, initialBalanceDate: balanceDate, isLiquid, color },
      });
      toast.show(t('accounts.saved'));
      onClose();
    } catch (error) {
      if (error instanceof ApiClientError) setErrors(error.fields);
      setFormError(errorMessage(error));
    }
  }

  async function toggleArchive() {
    if (!account) return;
    try {
      await save.mutateAsync({ id: account.id, payload: { archived: !account.archived } });
      toast.show(t('accounts.saved'));
      onClose();
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  async function onDelete() {
    if (!account) return;
    try {
      await remove.mutateAsync(account.id);
      toast.show(t('accounts.deleted'));
      setConfirmDelete(false);
      onClose();
    } catch (error) {
      setConfirmDelete(false);
      setFormError(errorMessage(error));
    }
  }

  const formId = 'account-form';
  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={editing ? t('accounts.edit') : t('accounts.add')}
        footer={
          <div className="flex gap-2">
            {editing && (
              <>
                <Button variant="danger" size="square" onClick={() => setConfirmDelete(true)} aria-label={t('common.delete')}>
                  <Trash2 className="h-5 w-5" aria-hidden />
                </Button>
                <Button
                  variant="soft"
                  size="square"
                  onClick={() => void toggleArchive()}
                  aria-label={account?.archived ? t('accounts.unarchive') : t('accounts.archive')}
                  title={account?.archived ? t('accounts.unarchive') : t('accounts.archive')}
                >
                  {account?.archived ? <ArchiveRestore className="h-5 w-5" aria-hidden /> : <Archive className="h-5 w-5" aria-hidden />}
                </Button>
              </>
            )}
            <Button type="submit" form={formId} className="flex-1" loading={save.isPending}>
              {save.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        }
      >
        <form id={formId} onSubmit={onSubmit} noValidate className="space-y-5 pt-1">
          <Field label={t('accounts.name')} error={err(errors.name)}>
            {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('accounts.namePlaceholder')} maxLength={60} autoComplete="off" />}
          </Field>

          <fieldset>
            <legend className="mb-2 px-1 text-sm font-medium text-ink-2">{t('accounts.type')}</legend>
            <div role="radiogroup" aria-label={t('accounts.type')} className="grid grid-cols-2 gap-2">
              {ACCOUNT_TYPES.map((value) => {
                const checked = type === value;
                return (
                  <label
                    key={value}
                    className={cn(
                      'flex min-h-14 cursor-pointer items-center gap-2.5 rounded-2xl border px-3 transition-colors',
                      checked ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:bg-surface-2',
                    )}
                  >
                    <input
                      type="radio"
                      name={typeName}
                      value={value}
                      checked={checked}
                      onChange={() => {
                        setType(value);
                        if (!editing) setIsLiquid(value !== 'other');
                      }}
                      className="sr-only"
                    />
                    <IconBadge icon={accountIcon(value)} color={color} size="sm" />
                    <span className={cn('min-w-0 text-[14px] leading-tight', checked ? 'font-semibold text-brand-ink' : 'text-ink-2')}>{t(`accountTypes.${value}`)}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div>
            <p className="mb-2 px-1 text-sm font-medium text-ink-2">{t('accounts.initialBalance')}</p>
            <AmountInput
              label={t('accounts.initialBalance')}
              value={balance}
              onChange={setBalance}
              size="md"
              allowNegative
              invalid={!!errors.initialBalanceCents}
              describedBy="initial-balance-hint"
            />
            <p id="initial-balance-hint" className={cn('mt-1.5 px-1 text-[13px] leading-snug', errors.initialBalanceCents ? 'text-danger' : 'text-ink-3')}>
              {errors.initialBalanceCents ? err(errors.initialBalanceCents) : t('accounts.initialBalanceHint')}
            </p>
          </div>

          <Field label={t('accounts.initialBalanceDate')} error={err(errors.initialBalanceDate)}>
            {(p) => <Input {...p} type="date" value={balanceDate} onChange={(e) => setBalanceDate(e.target.value)} />}
          </Field>

          <Switch checked={isLiquid} onChange={setIsLiquid} label={t('accounts.isLiquid')} description={t('accounts.isLiquidHint')} />

          <fieldset>
            <legend className="mb-2 px-1 text-sm font-medium text-ink-2">{t('accounts.color')}</legend>
            <div className="flex flex-wrap gap-2">
              {ACCOUNT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-pressed={color === c}
                  aria-label={c}
                  className={cn('h-11 w-11 rounded-full border-4 transition-transform', color === c ? 'scale-105 border-ink/80' : 'border-surface')}
                  style={{ background: c }}
                />
              ))}
            </div>
          </fieldset>

          <p className="px-1 text-[13px] text-ink-3">
            {t('accounts.currency')}: <span className="font-semibold text-ink-2">{f.currency}</span> · {t('settings.currencyNote')}
          </p>

          {editing && account?.archived && <p className="rounded-2xl bg-surface-2 px-3 py-2.5 text-[13px] text-ink-3">{t('accounts.archivedHint')}</p>}

          {formError && (
            <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
              {formError}
            </p>
          )}
        </form>
      </Sheet>
      <ConfirmDialog
        open={confirmDelete}
        title={t('accounts.deleteConfirmTitle')}
        description={tp('accounts.deleteConfirmText', account?.transactionCount ?? 0)}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void onDelete()}
        loading={remove.isPending}
      />
    </>
  );
}
