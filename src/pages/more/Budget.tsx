import { Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BudgetProgress } from '../../components/BudgetBar';
import { MonthSelector } from '../../components/MonthSelector';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card, CardTitle } from '../../components/ui/Card';
import { cn } from '../../components/ui/cn';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/Toast';
import { customizeMonth, resetMonthToDefault, saveBudget } from '../../db/repo';
import { formatMonthYear } from '../../lib/dates';
import { budgetReport, resolveBudget } from '../../lib/finance/budget';
import { expensesByCategory, flowTotals, inMonth } from '../../lib/finance/cashflow';
import { centsToInput, parseAmount } from '../../lib/money';
import type { Budget } from '../../lib/types';
import { useAppState } from '../../state/app';
import { useStore } from '../../state/data';
import { T } from '../../texts';

const b = T.budget;

export function BudgetPage() {
  const store = useStore();
  const { month } = useAppState();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const { budget, source } = resolveBudget(store.budgets, month);
  const report = useMemo(() => {
    const monthTxs = inMonth(store.transactions, month);
    return budgetReport(budget, expensesByCategory(monthTxs), flowTotals(monthTxs).expenseCents);
  }, [store.transactions, month, budget]);
  const monthName = formatMonthYear(month, false);
  const editTarget: Budget['month'] = source === 'custom' ? month : 'default';

  return (
    <>
      <PageHeader
        title={b.title}
        back="/mes"
        action={
          !editing && (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)} data-testid="edit-budget">
              <Pencil className="h-4 w-4" aria-hidden />
              {T.common.edit}
            </Button>
          )
        }
      />
      <div className="space-y-3">
        <MonthSelector disabled={editing} />

        <Card className="flex flex-col gap-3" data-testid="budget-source">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                'shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold',
                source === 'custom' ? 'bg-transfer-soft text-transfer-ink' : 'bg-soft-2 text-ink-2',
              )}
            >
              {source === 'custom' ? b.customBadge : b.defaultBadge}
            </span>
            <p className="min-w-0 text-[14px] leading-snug text-ink-2">{source === 'custom' ? b.customInfo(monthName) : b.defaultInfo}</p>
          </div>
          {!editing &&
            (source === 'custom' ? (
              <Button variant="outline" size="sm" onClick={() => setConfirmReset(true)}>
                {b.resetToDefault}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await customizeMonth(month);
                  setEditing(true);
                }}
                data-testid="customize-month"
              >
                {b.customize}
              </Button>
            ))}
        </Card>

        {editing ? (
          <BudgetEditor
            key={`${editTarget}-${month}`}
            target={editTarget}
            title={editTarget === 'default' ? b.editingDefault : b.editingCustom(monthName)}
            onDone={(saved) => {
              setEditing(false);
              if (saved) toast(b.saved);
            }}
          />
        ) : !budget || (!report.total && report.categories.length === 0) ? (
          <Card>
            <EmptyState
              icon="🎯"
              title={b.none}
              hint={b.noneHint}
              action={
                <Button size="sm" onClick={() => setEditing(true)}>
                  {b.define}
                </Button>
              }
            />
          </Card>
        ) : (
          <>
            {report.total && (
              <Card>
                <BudgetProgress line={report.total} title={b.total} testId="budget-total" />
              </Card>
            )}
            <Card>
              <CardTitle>{b.perCategory}</CardTitle>
              {report.categories.length === 0 ? (
                <p className="text-[14px] text-ink-3">{b.noCategoryBudgets}</p>
              ) : (
                <ul className="space-y-5">
                  {report.categories.map((line) => {
                    const cat = store.categoryById.get(line.categoryId!);
                    return (
                      <li key={line.categoryId}>
                        <BudgetProgress
                          line={line}
                          testId={`budget-line-${cat?.name ?? ''}`}
                          title={
                            <>
                              <span aria-hidden>{cat?.emoji}</span> {cat?.name ?? '—'}
                            </>
                          }
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
            <p className="px-1 text-[13px] text-ink-3">{b.informative}</p>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmReset}
        title={b.resetConfirmTitle}
        body={b.resetConfirmBody(monthName)}
        confirmLabel={b.resetToDefault}
        onClose={() => setConfirmReset(false)}
        onConfirm={async () => {
          await resetMonthToDefault(month);
          setConfirmReset(false);
        }}
      />
    </>
  );
}

function BudgetEditor({ target, title, onDone }: { target: Budget['month']; title: string; onDone: (saved: boolean) => void }) {
  const store = useStore();
  const current = store.budgets.find((x) => x.month === target);
  const expenseCategories = store.categories.filter((c) => c.kind === 'expense');
  const [total, setTotal] = useState(current?.totalCents ? centsToInput(current.totalCents) : '');
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(expenseCategories.map((c) => [c.id, current?.perCategory[c.id] ? centsToInput(current.perCategory[c.id]) : ''])),
  );
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const parse = (text: string) => (text.trim() === '' ? 0 : parseAmount(text));
    const nextErrors: Record<string, boolean> = {};
    const totalCents = parse(total);
    if (totalCents === null || totalCents < 0) nextErrors.__total = true;
    const perCategory: Record<string, number> = {};
    for (const [id, text] of Object.entries(values)) {
      const cents = parse(text);
      if (cents === null || cents < 0) nextErrors[id] = true;
      else if (cents > 0) perCategory[id] = cents;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setBusy(true);
    await saveBudget(target, totalCents ?? 0, perCategory);
    onDone(true);
  };

  return (
    <Card data-testid="budget-editor">
      <CardTitle subtitle={b.editHint}>{title}</CardTitle>
      <div className="space-y-4">
        <AmountRow label={b.totalShort} ariaLabel={b.total} value={total} onChange={setTotal} invalid={errors.__total} strong testId="budget-input-total" />
        <div className="border-t border-line pt-4">
          <p className="mb-3 text-[14px] font-semibold text-ink-2">{b.perCategory}</p>
          <div className="space-y-2.5">
            {expenseCategories.map((c) => (
              <AmountRow
                key={c.id}
                label={
                  <>
                    <span aria-hidden>{c.emoji}</span> {c.name}
                  </>
                }
                ariaLabel={c.name}
                value={values[c.id] ?? ''}
                onChange={(v) => setValues((s) => ({ ...s, [c.id]: v }))}
                invalid={errors[c.id]}
                testId={`budget-input-${c.name}`}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" block onClick={() => onDone(false)}>
            {T.common.cancel}
          </Button>
          <Button block onClick={save} disabled={busy} data-testid="save-budget">
            {T.common.save}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function AmountRow({
  label,
  ariaLabel,
  value,
  onChange,
  invalid,
  strong,
  testId,
}: {
  label: React.ReactNode;
  ariaLabel?: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  strong?: boolean;
  testId?: string;
}) {
  return (
    <div>
      <label className="flex min-w-0 items-center gap-3">
        <span className={cn('min-w-0 flex-1 truncate text-[15px]', strong ? 'font-semibold' : 'font-medium')}>{label}</span>
        <span className="relative w-[132px] shrink-0">
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            aria-label={ariaLabel}
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
            placeholder="—"
            title={T.budget.noBudget}
            data-testid={testId}
            className={cn(
              'h-12 w-full rounded-xl border bg-surface pl-3 pr-8 text-right text-[16px] tabular outline-none placeholder:text-ink-4 focus:border-ink-3',
              invalid ? 'border-expense' : 'border-line-strong',
            )}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3">€</span>
        </span>
      </label>
      {invalid && (
        <p role="alert" className="mt-1 text-right text-[13px] font-medium text-expense-ink">
          {T.validation.amountInvalid}
        </p>
      )}
    </div>
  );
}
