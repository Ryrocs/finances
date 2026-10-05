'use client';

import { ArrowLeftRight, Repeat } from 'lucide-react';
import { useI18n } from '@/components/providers/I18nProvider';
import { cn } from '@/components/ui/cn';
import { CategoryBadge, IconBadge } from '@/components/ui/icons';
import { Badge } from '@/components/ui/States';
import { useFormat, useLookups } from '@/hooks/useFormat';
import type { TransactionDTO } from '@/lib/types';

export function MovementRow({ tx, onSelect }: { tx: TransactionDTO; onSelect: (tx: TransactionDTO) => void }) {
  const { t } = useI18n();
  const f = useFormat();
  const { category, categoryLabel, accountName } = useLookups();
  const cat = category(tx.categoryId);
  const isTransfer = tx.type === 'transfer';
  const transferLabel = t('movements.transferLabel', { from: accountName(tx.accountId), to: accountName(tx.toAccountId) });
  const title = tx.description || (isTransfer ? t('types.transfer') : categoryLabel(cat));
  const subtitle = isTransfer ? transferLabel : tx.description ? `${categoryLabel(cat)} · ${accountName(tx.accountId)}` : accountName(tx.accountId);
  const amount =
    tx.type === 'expense' ? f.money(-tx.amountCents) : tx.type === 'income' ? f.money(tx.amountCents, { signed: true }) : f.money(tx.amountCents);
  const upcoming = tx.date > f.today;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(tx)}
        className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors hover:bg-surface-2 active:bg-surface-3"
      >
        {isTransfer ? <IconBadge icon={ArrowLeftRight} color="#2563eb" /> : <CategoryBadge category={cat} />}
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold text-ink">{title}</span>
            {tx.recurringId && <Repeat className="h-3.5 w-3.5 shrink-0 text-ink-4" aria-label={t('common.recurring')} />}
            {tx.isDemo && <Badge size="sm" className="shrink-0">{t('common.demo')}</Badge>}
            {upcoming && (
              <Badge tone="transfer" size="sm" className="shrink-0">
                {t('common.upcoming')}
              </Badge>
            )}
          </span>
          <span className="block truncate text-[13px] text-ink-3">{subtitle}</span>
        </span>
        <span
          className={cn(
            'shrink-0 text-right text-[15px] font-semibold tabular',
            tx.type === 'expense' ? 'text-ink' : tx.type === 'income' ? 'text-income' : 'text-transfer',
          )}
        >
          {amount}
        </span>
      </button>
    </li>
  );
}
