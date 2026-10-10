import { useMemo, useRef, useState } from 'react';
import { createRule, saveMovement, updateRule, type MovementData } from '../../db/repo';
import { formatLongDate, parseISODate, WEEKDAYS, weekdayOf, type ISODate } from '../../lib/dates';
import { centsToInput, parseAmount } from '../../lib/money';
import type { Frequency, RecurringRule, Transaction, TransactionType } from '../../lib/types';
import { hasErrors, validateMovement, validateSchedule, type FieldErrors, type MovementField } from '../../lib/validation';
import { useAppState } from '../../state/app';
import { useStore } from '../../state/data';
import { T } from '../../texts';
import { DateField } from '../forms/DateField';
import { Button } from '../ui/Button';
import { cn } from '../ui/cn';
import { Field, Select, TextArea, TextInput, useFieldId } from '../ui/Field';
import { Segmented } from '../ui/Segmented';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import { Chip, ChipGroup } from './Chips';

export type FormMode = { kind: 'new'; type?: TransactionType } | { kind: 'edit'; tx: Transaction } | { kind: 'rule'; rule: RecurringRule };

type Errors = FieldErrors<MovementField | 'endDate'>;

const f = T.form;

const TYPE_OPTIONS = [
  { value: 'expense', label: T.types.expense, activeClass: 'bg-expense text-white' },
  { value: 'income', label: T.types.income, activeClass: 'bg-income text-white' },
  { value: 'transfer', label: T.types.transfer, activeClass: 'bg-transfer text-white' },
] as const;

const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: f.frequency.weekly },
  { value: 'monthly', label: f.frequency.monthly },
  { value: 'yearly', label: f.frequency.yearly },
] as const;

/** Keeps only what an amount can contain, so a stray letter never reaches the field. */
function sanitizeAmount(text: string) {
  return text.replace(/[^\d.,]/g, '').slice(0, 16);
}

export function MovementForm({ mode, onClose }: { mode: FormMode; onClose: () => void }) {
  const store = useStore();
  const { today } = useAppState();
  const toast = useToast();
  const { accounts, categories, transactions, settings } = store;
  const bodyRef = useRef<HTMLDivElement>(null);

  const initial = useMemo(() => {
    if (mode.kind === 'edit') {
      const tx = mode.tx;
      return {
        type: tx.type,
        amount: centsToInput(tx.amountCents),
        categoryId: tx.categoryId,
        accountId: tx.accountId,
        toAccountId: tx.toAccountId,
        date: tx.date,
        description: tx.description ?? '',
        notes: tx.notes ?? '',
        recurring: false,
        frequency: 'monthly' as Frequency,
        dayOfMonth: parseISODate(tx.date).d,
        weekday: weekdayOf(tx.date),
        endDate: '',
      };
    }
    if (mode.kind === 'rule') {
      const r = mode.rule;
      return {
        type: r.type,
        amount: centsToInput(r.amountCents),
        categoryId: r.categoryId,
        accountId: r.accountId,
        toAccountId: r.toAccountId,
        date: r.startDate,
        description: r.description ?? '',
        notes: r.notes ?? '',
        recurring: true,
        frequency: r.frequency,
        dayOfMonth: r.dayOfMonth ?? parseISODate(r.startDate).d,
        weekday: r.weekday ?? weekdayOf(r.startDate),
        endDate: r.endDate ?? '',
      };
    }
    const last = settings.lastAccountId && store.accountById.has(settings.lastAccountId) ? settings.lastAccountId : accounts[0]?.id;
    return {
      type: mode.type ?? ('expense' as TransactionType),
      amount: '',
      categoryId: undefined,
      accountId: last,
      toAccountId: accounts.length === 2 ? accounts.find((a) => a.id !== last)?.id : undefined,
      date: today,
      description: '',
      notes: '',
      recurring: false,
      frequency: 'monthly' as Frequency,
      dayOfMonth: parseISODate(today).d,
      weekday: weekdayOf(today),
      endDate: '',
    };
    // The form is mounted once per opening: the initial values must not follow later changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [type, setType] = useState<TransactionType>(initial.type);
  const [amount, setAmount] = useState(initial.amount);
  const [categoryId, setCategoryId] = useState<string | undefined>(initial.categoryId);
  const [accountId, setAccountId] = useState<string | undefined>(initial.accountId);
  const [toAccountId, setToAccountId] = useState<string | undefined>(initial.toAccountId);
  const [date, setDate] = useState<ISODate>(initial.date);
  const [description, setDescription] = useState(initial.description);
  const [notes, setNotes] = useState(initial.notes);
  const [showNotes, setShowNotes] = useState(initial.notes !== '');
  const [recurring, setRecurring] = useState(initial.recurring);
  const [frequency, setFrequency] = useState<Frequency>(initial.frequency);
  const [dayOfMonth, setDayOfMonth] = useState(initial.dayOfMonth);
  const [weekday, setWeekday] = useState(initial.weekday);
  const [dayTouched, setDayTouched] = useState(mode.kind === 'rule');
  const [endDate, setEndDate] = useState(initial.endDate);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const amountId = useFieldId('amount');
  const descriptionId = useFieldId('description');
  const notesId = useFieldId('notes');
  const dayId = useFieldId('day');
  const endId = useFieldId('end');

  // Most used categories first.
  const sortedCategories = useMemo(() => {
    const usage = new Map<string, number>();
    for (const tx of transactions) if (tx.categoryId) usage.set(tx.categoryId, (usage.get(tx.categoryId) ?? 0) + 1);
    return categories
      .filter((c) => c.kind === (type === 'income' ? 'income' : 'expense'))
      .sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) || a.order - b.order);
  }, [categories, transactions, type]);

  const clearError = (...keys: Array<keyof Errors>) =>
    setErrors((e) => {
      if (!keys.some((k) => e[k])) return e;
      const next = { ...e };
      for (const k of keys) delete next[k];
      return next;
    });

  const changeType = (next: TransactionType) => {
    setType(next);
    // Expense and income categories are different lists.
    if (next !== type) setCategoryId(undefined);
    setErrors({});
  };

  const changeDate = (next: ISODate) => {
    setDate(next);
    if (!dayTouched) {
      setDayOfMonth(parseISODate(next).d);
      setWeekday(weekdayOf(next));
    }
    clearError('date', 'endDate');
  };

  const isRecurring = mode.kind === 'rule' || (mode.kind === 'new' && recurring);

  const submit = async () => {
    const amountCents = parseAmount(amount);
    const input = {
      type,
      date,
      amountCents,
      categoryId: type === 'transfer' ? undefined : categoryId,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      description,
      notes: showNotes ? notes : '',
    };
    const next: Errors = { ...validateMovement(input, accounts, categories) };
    if (isRecurring) Object.assign(next, validateSchedule({ frequency, startDate: date, endDate: endDate || undefined }));
    if (hasErrors(next)) {
      setErrors(next);
      requestAnimationFrame(() => bodyRef.current?.querySelector('[role="alert"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
      return;
    }
    const data: MovementData = { ...input, amountCents: amountCents!, accountId: accountId! };
    const schedule = {
      frequency,
      dayOfMonth: frequency === 'monthly' ? dayOfMonth : frequency === 'yearly' ? parseISODate(date).d : undefined,
      weekday: frequency === 'weekly' ? weekday : undefined,
      startDate: date,
      endDate: endDate || undefined,
    };
    setBusy(true);
    try {
      if (mode.kind === 'edit') {
        await saveMovement(data, mode.tx.id);
        toast(f.saved);
      } else if (mode.kind === 'rule') {
        await updateRule(mode.rule.id, { ...data, ...schedule }, today);
        toast(f.ruleSaved);
      } else if (isRecurring) {
        const { generated } = await createRule({ ...data, ...schedule }, today);
        toast(f.ruleCreated(generated));
      } else {
        await saveMovement(data);
        toast(f.saved);
      }
      onClose();
    } catch (e) {
      console.error(e);
      setBusy(false);
      toast(T.common.error, 'error');
    }
  };

  const title = mode.kind === 'edit' ? f.editTitle : mode.kind === 'rule' ? f.editRuleTitle : f.newTitle;
  const accountLabel = type === 'transfer' ? f.fromAccount : f.account;

  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      testId="movement-form"
      fill
      header={<Segmented label={T.detail.type} value={type} options={TYPE_OPTIONS} onChange={changeType} />}
      footer={
        <Button block size="lg" onClick={submit} disabled={busy} data-testid="save-movement">
          {T.common.save}
        </Button>
      }
    >
      <div ref={bodyRef} className="space-y-5 pb-2">
        {accounts.length === 0 && <p className="rounded-xl bg-warning-soft p-3 text-[14px] text-warning-ink">{f.noAccounts}</p>}

        <Field label={f.amount} htmlFor={amountId} error={errors.amount}>
          <div className={cn('flex items-baseline gap-2 rounded-2xl border bg-surface px-4', errors.amount ? 'border-expense' : 'border-line-strong focus-within:border-ink-3')}>
            <input
              id={amountId}
              ref={(el) => {
                if (el && mode.kind === 'new') el.setAttribute('autofocus', '');
              }}
              data-autofocus={mode.kind === 'new' ? '' : undefined}
              type="text"
              inputMode="decimal"
              enterKeyHint="done"
              autoComplete="off"
              placeholder="0,00"
              value={amount}
              onChange={(e) => {
                setAmount(sanitizeAmount(e.target.value));
                clearError('amount');
              }}
              className={cn(
                'h-16 min-w-0 flex-1 bg-transparent text-[34px] font-bold tabular outline-none placeholder:text-ink-4 focus-visible:outline-none',
                type === 'expense' ? 'text-expense-ink' : type === 'income' ? 'text-income-ink' : 'text-transfer-ink',
              )}
            />
            <span className="text-[26px] font-semibold text-ink-3">€</span>
          </div>
        </Field>

        {type !== 'transfer' && (
          <Field label={f.category} error={errors.category}>
            <ChipGroup label={f.category} invalid={!!errors.category}>
              {sortedCategories.map((c) => (
                <Chip
                  key={c.id}
                  selected={categoryId === c.id}
                  testId={`category-chip-${c.name}`}
                  onClick={() => {
                    setCategoryId(c.id);
                    clearError('category');
                  }}
                >
                  <span aria-hidden>{c.emoji}</span>
                  <span className="truncate">{c.name}</span>
                </Chip>
              ))}
            </ChipGroup>
          </Field>
        )}

        <Field label={accountLabel} error={errors.account}>
          <ChipGroup label={accountLabel} invalid={!!errors.account}>
            {accounts.map((a) => (
              <Chip
                key={a.id}
                selected={accountId === a.id}
                testId={`account-chip-${a.name}`}
                onClick={() => {
                  setAccountId(a.id);
                  clearError('account', 'date', 'toAccount');
                }}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: a.color }} aria-hidden />
                <span className="truncate">{a.name}</span>
              </Chip>
            ))}
          </ChipGroup>
        </Field>

        {type === 'transfer' && (
          <Field label={f.toAccount} error={errors.toAccount}>
            <ChipGroup label={f.toAccount} invalid={!!errors.toAccount}>
              {accounts.map((a) => (
                <Chip
                  key={a.id}
                  selected={toAccountId === a.id}
                  testId={`to-account-chip-${a.name}`}
                  onClick={() => {
                    setToAccountId(a.id);
                    clearError('toAccount', 'date');
                  }}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: a.color }} aria-hidden />
                  <span className="truncate">{a.name}</span>
                </Chip>
              ))}
            </ChipGroup>
          </Field>
        )}

        <DateField label={isRecurring ? f.startDate : f.date} value={date} onChange={changeDate} error={errors.date} today={today} testId="movement-date" />

        {mode.kind === 'new' && (
          <Segmented
            label={f.recurring}
            value={recurring ? 'recurring' : 'once'}
            options={[
              { value: 'once', label: f.once },
              { value: 'recurring', label: f.recurring },
            ]}
            onChange={(v) => {
              setRecurring(v === 'recurring');
              clearError('endDate');
            }}
          />
        )}

        {isRecurring && (
          <div className="space-y-4 rounded-2xl bg-soft p-4">
            <Field label={f.repeatEvery}>
              <Segmented label={f.repeatEvery} value={frequency} options={FREQUENCY_OPTIONS} onChange={setFrequency} size="sm" />
            </Field>
            {frequency === 'weekly' && (
              <Field label={f.weekday} htmlFor={dayId}>
                <Select
                  id={dayId}
                  value={weekday}
                  onChange={(e) => {
                    setWeekday(Number(e.target.value));
                    setDayTouched(true);
                  }}
                >
                  {WEEKDAYS.map((name, i) => (
                    <option key={name} value={i + 1}>
                      {name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {frequency === 'monthly' && (
              <Field label={f.day} htmlFor={dayId} hint={dayOfMonth > 28 ? f.lastDayHint : undefined}>
                <Select
                  id={dayId}
                  value={dayOfMonth}
                  onChange={(e) => {
                    setDayOfMonth(Number(e.target.value));
                    setDayTouched(true);
                  }}
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {frequency === 'yearly' && <p className="text-[14px] text-ink-2">{f.yearlyHint(formatLongDate(date).replace(/ de \d{4}$/, ''))}</p>}
            <Field
              label={f.endDate}
              htmlFor={endId}
              error={errors.endDate}
              trailing={
                endDate ? (
                  <button type="button" onClick={() => setEndDate('')} className="-my-2 h-11 rounded-lg px-2 text-[13px] font-semibold text-ink-2 active:bg-soft-2">
                    {f.noEndDate}
                  </button>
                ) : (
                  <span className="text-[13px] text-ink-3">{T.common.optional}</span>
                )
              }
            >
              <TextInput
                id={endId}
                type="date"
                value={endDate}
                min={date}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  clearError('endDate');
                }}
                invalid={!!errors.endDate}
              />
            </Field>
            {mode.kind === 'new' && date <= today && <p className="text-[13px] text-ink-3">{f.backfillHint}</p>}
          </div>
        )}

        <Field label={f.description} htmlFor={descriptionId}>
          <TextInput
            id={descriptionId}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={f.descriptionPlaceholder}
            maxLength={120}
            autoComplete="off"
            enterKeyHint="done"
          />
        </Field>

        {showNotes ? (
          <Field label={f.notes} htmlFor={notesId}>
            <TextArea id={notesId} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} rows={3} />
          </Field>
        ) : (
          <button type="button" onClick={() => setShowNotes(true)} className="h-11 rounded-xl px-1 text-[15px] font-semibold text-transfer-ink active:bg-soft">
            + {f.addNote}
          </button>
        )}
      </div>
    </Sheet>
  );
}
