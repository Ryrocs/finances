import { Pause, Pencil, Play, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { CategoryIcon } from '../../components/CategoryIcon';
import { PageHeader } from '../../components/PageHeader';
import { signedAmount } from '../../components/MovementRow';
import { useSheets } from '../../components/sheets/SheetsProvider';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { cn } from '../../components/ui/cn';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import { deleteRule, setRuleActive } from '../../db/repo';
import { formatLongDate, formatShortDate, WEEKDAYS } from '../../lib/dates';
import { nextOccurrence, ruleDay, ruleWeekday } from '../../lib/finance/recurring';
import type { RecurringRule } from '../../lib/types';
import { useAppState } from '../../state/app';
import { useStore, type Store } from '../../state/data';
import { T } from '../../texts';

const r = T.recurring;

export function frequencyLabel(rule: RecurringRule): string {
  if (rule.frequency === 'weekly') return r.weekly(WEEKDAYS[ruleWeekday(rule) - 1]);
  if (rule.frequency === 'monthly') return r.monthly(ruleDay(rule));
  return r.yearly(formatLongDate(rule.startDate).replace(/ de \d{4}$/, ''));
}

function describeRule(rule: RecurringRule, store: Store) {
  const category = rule.categoryId ? store.categoryById.get(rule.categoryId) : undefined;
  const account = store.accountById.get(rule.accountId)?.name ?? '—';
  if (rule.type === 'transfer') {
    const to = (rule.toAccountId && store.accountById.get(rule.toAccountId)?.name) || '—';
    return { category, title: rule.description || T.types.transfer, accounts: `${account} → ${to}` };
  }
  return { category, title: rule.description || category?.name || '—', accounts: account };
}

export function RecurringPage() {
  const store = useStore();
  const { today } = useAppState();
  const [selected, setSelected] = useState<RecurringRule | null>(null);
  const year = Number(today.slice(0, 4));
  const rules = [...store.rules].sort((a, b) => Number(b.active) - Number(a.active) || a.createdAt - b.createdAt);

  return (
    <>
      <PageHeader title={r.title} back="/mes" />
      {rules.length === 0 ? (
        <Card>
          <EmptyState icon="🔁" title={r.empty} hint={r.emptyHint} />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-line">
            {rules.map((rule) => {
              const { category, title, accounts } = describeRule(rule, store);
              const next = nextOccurrence(rule, today);
              const amount = signedAmount(rule);
              const status = !rule.active ? r.paused : next ? r.next(formatShortDate(next, year)) : r.ended;
              return (
                <li key={rule.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(rule)}
                    data-testid="rule-row"
                    className={cn('flex w-full min-w-0 items-center gap-3 px-3 py-3 text-left active:bg-soft', !rule.active && 'opacity-60')}
                  >
                    <CategoryIcon category={category} transfer={rule.type === 'transfer'} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{title}</span>
                      <span className="block truncate text-[13px] text-ink-3">{frequencyLabel(rule)}</span>
                      <span className="block truncate text-[13px] text-ink-3">
                        {status} · {accounts}
                      </span>
                    </span>
                    <span className={cn('money shrink-0 text-[15px] font-semibold', amount.className)}>{amount.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      {selected && <RuleActions key={selected.id} rule={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function RuleActions({ rule: initial, onClose }: { rule: RecurringRule; onClose: () => void }) {
  const store = useStore();
  const { today } = useAppState();
  const { openRule } = useSheets();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const rule = store.rules.find((x) => x.id === initial.id) ?? initial;
  const { category, title, accounts } = describeRule(rule, store);
  const amount = signedAmount(rule);
  const next = nextOccurrence(rule, today);
  const year = Number(today.slice(0, 4));

  return (
    <>
      <Sheet open onClose={onClose} title={title} testId="rule-actions">
        <div className="flex items-center gap-3 rounded-card border border-line p-3">
          <CategoryIcon category={category} transfer={rule.type === 'transfer'} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">{frequencyLabel(rule)}</p>
            <p className="truncate text-[13px] text-ink-3">{accounts}</p>
            <p className="truncate text-[13px] text-ink-3">
              {!rule.active ? r.paused : next ? r.next(formatShortDate(next, year)) : r.ended}
              {rule.endDate && ` · ${r.until(formatShortDate(rule.endDate, year))}`}
            </p>
          </div>
          <span className={cn('money shrink-0 text-[16px] font-bold', amount.className)}>{amount.text}</span>
        </div>
        <div className="mt-4 space-y-2.5">
          <Button
            variant="outline"
            block
            onClick={() => {
              onClose();
              openRule(rule);
            }}
          >
            <Pencil className="h-4 w-4" aria-hidden />
            {T.common.edit}
          </Button>
          <Button
            variant="outline"
            block
            onClick={async () => {
              await setRuleActive(rule.id, !rule.active, today);
              toast(rule.active ? r.paused_toast : r.resumed_toast);
              onClose();
            }}
          >
            {rule.active ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
            {rule.active ? r.pause : r.resume}
          </Button>
          <Button variant="outline" block className="text-expense-ink" onClick={() => setConfirming(true)}>
            <Trash2 className="h-4 w-4" aria-hidden />
            {T.common.delete}
          </Button>
        </div>
      </Sheet>
      <ConfirmDialog
        open={confirming}
        title={r.deleteTitle}
        body={r.deleteBody}
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          await deleteRule(rule.id);
          setConfirming(false);
          toast(r.deleted);
          onClose();
        }}
      />
    </>
  );
}
