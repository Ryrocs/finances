import { useState, type ReactNode } from 'react';
import { deleteMovement } from '../../db/repo';
import { formatFullDate } from '../../lib/dates';
import type { Transaction } from '../../lib/types';
import { useStore } from '../../state/data';
import { T } from '../../texts';
import { CategoryIcon } from '../CategoryIcon';
import { describeMovement, signedAmount } from '../MovementRow';
import { Button } from '../ui/Button';
import { cn } from '../ui/cn';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';

const d = T.detail;

export function MovementDetail({ tx, onClose, onEdit }: { tx: Transaction; onClose: () => void; onEdit: (tx: Transaction) => void }) {
  const store = useStore();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  // Follow live edits (e.g. after saving from the edit form) and disappear if deleted elsewhere.
  const current = store.transactions.find((t) => t.id === tx.id) ?? tx;
  const { category, title } = describeMovement(current, store);
  const amount = signedAmount(current);
  const account = store.accountById.get(current.accountId)?.name ?? '—';
  const toAccount = current.toAccountId ? (store.accountById.get(current.toAccountId)?.name ?? '—') : '';

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={d.title}
        testId="movement-detail"
        footer={
          <div className="flex gap-3">
            <Button variant="dangerSoft" block onClick={() => setConfirming(true)}>
              {T.common.delete}
            </Button>
            <Button block onClick={() => onEdit(current)}>
              {T.common.edit}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col items-center pb-4 pt-2 text-center">
          <CategoryIcon category={category} transfer={current.type === 'transfer'} size="lg" />
          <p className="mt-3 max-w-full truncate text-[17px] font-semibold">{title}</p>
          <p className={cn('money mt-1 text-[32px] font-bold', amount.className)}>{amount.text}</p>
        </div>
        <dl className="divide-y divide-line rounded-card border border-line">
          <Row label={d.type}>{T.types[current.type]}</Row>
          {current.type !== 'transfer' && (
            <Row label={d.category}>
              {category?.emoji} {category?.name ?? '—'}
            </Row>
          )}
          {current.type === 'transfer' ? (
            <>
              <Row label={d.fromAccount}>{account}</Row>
              <Row label={d.toAccount}>{toAccount}</Row>
            </>
          ) : (
            <Row label={d.account}>{account}</Row>
          )}
          <Row label={d.date}>{formatFullDate(current.date)}</Row>
          {current.description && <Row label={d.description}>{current.description}</Row>}
          {current.notes && (
            <Row label={d.notes}>
              <span className="whitespace-pre-wrap">{current.notes}</span>
            </Row>
          )}
          {current.source !== 'manual' && <Row label={d.source}>{T.source[current.source]}</Row>}
        </dl>
        {current.source === 'recurring' && <p className="mt-3 text-[13px] text-ink-3">{d.recurringNote}</p>}
        {current.source === 'interest' && <p className="mt-3 text-[13px] text-ink-3">{d.interestNote}</p>}
      </Sheet>
      <ConfirmDialog
        open={confirming}
        title={d.deleteTitle}
        body={d.deleteBody}
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          await deleteMovement(current.id);
          setConfirming(false);
          toast(d.deleted);
          onClose();
        }}
      />
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-4 px-4 py-3">
      <dt className="shrink-0 text-[14px] text-ink-3">{label}</dt>
      <dd className="min-w-0 break-words text-right text-[15px] font-medium text-ink">{children}</dd>
    </div>
  );
}
