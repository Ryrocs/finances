import { Percent, Repeat } from 'lucide-react';
import { formatEUR } from '../lib/money';
import type { Transaction } from '../lib/types';
import type { Store } from '../state/data';
import { T } from '../texts';
import { CategoryIcon } from './CategoryIcon';
import { cn } from './ui/cn';

export function describeMovement(tx: Transaction, store: Pick<Store, 'accountById' | 'categoryById'>) {
  const category = tx.categoryId ? store.categoryById.get(tx.categoryId) : undefined;
  const account = store.accountById.get(tx.accountId)?.name ?? '—';
  if (tx.type === 'transfer') {
    const to = (tx.toAccountId && store.accountById.get(tx.toAccountId)?.name) || '—';
    return { category, title: tx.description || T.types.transfer, subtitle: `${account} → ${to}` };
  }
  const categoryName = category?.name ?? '—';
  return { category, title: tx.description || categoryName, subtitle: `${categoryName} · ${account}` };
}

/** "+24,50 €" (green) for income, "−24,50 €" (red) for expenses, neutral for transfers. */
export function signedAmount(tx: Pick<Transaction, 'type' | 'amountCents'>): { text: string; className: string } {
  if (tx.type === 'income') return { text: formatEUR(tx.amountCents, { signed: true }), className: 'text-income-ink' };
  if (tx.type === 'expense') return { text: formatEUR(-tx.amountCents), className: 'text-expense-ink' };
  return { text: formatEUR(tx.amountCents), className: 'text-ink-2' };
}

export function MovementRow({ tx, store, onSelect }: { tx: Transaction; store: Pick<Store, 'accountById' | 'categoryById'>; onSelect: (tx: Transaction) => void }) {
  const { category, title, subtitle } = describeMovement(tx, store);
  const amount = signedAmount(tx);
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(tx)}
        data-testid="movement-row"
        className="flex min-h-[60px] w-full min-w-0 items-center gap-3 px-3 py-2.5 text-left transition-colors active:bg-soft"
      >
        <CategoryIcon category={category} transfer={tx.type === 'transfer'} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold text-ink">{title}</span>
            {tx.source === 'recurring' && <Repeat className="h-3.5 w-3.5 shrink-0 text-ink-4" aria-label={T.movements.recurringMark} />}
            {tx.source === 'interest' && <Percent className="h-3.5 w-3.5 shrink-0 text-ink-4" aria-label={T.movements.interestMark} />}
          </span>
          <span className="block truncate text-[13px] text-ink-3">{subtitle}</span>
        </span>
        <span className={cn('money shrink-0 text-right text-[15px] font-semibold', amount.className)} data-testid="movement-amount">
          {amount.text}
        </span>
      </button>
    </li>
  );
}
