import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AccountFields, checkDraft, draftFromAccount, type AccountDraft } from '../../components/forms/AccountFields';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { cn } from '../../components/ui/cn';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import { runAutomation } from '../../db/automation';
import { createAccount, deleteAccount, updateAccount } from '../../db/repo';
import { PALETTE } from '../../db/seed';
import { balancesAsOf, movementCountByAccount } from '../../lib/finance/balances';
import { formatEUR, formatPercent } from '../../lib/money';
import type { Account } from '../../lib/types';
import type { AccountField, FieldErrors } from '../../lib/validation';
import { useAppState } from '../../state/app';
import { useStore } from '../../state/data';
import { T } from '../../texts';

const t = T.accounts;

export function AccountsPage() {
  const { accounts, transactions } = useStore();
  const { today } = useAppState();
  const [editing, setEditing] = useState<Account | 'new' | null>(null);
  const balances = useMemo(() => balancesAsOf(accounts, transactions, today), [accounts, transactions, today]);
  const counts = useMemo(() => movementCountByAccount(transactions), [transactions]);

  return (
    <>
      <PageHeader
        title={t.title}
        back="/mes"
        action={
          <Button size="sm" onClick={() => setEditing('new')} data-testid="new-account">
            <Plus className="h-4 w-4" aria-hidden />
            {T.common.add}
          </Button>
        }
      />
      {accounts.length === 0 ? (
        <Card>
          <EmptyState icon="🏦" title={t.empty} />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-line">
            {accounts.map((a) => {
              const balance = balances.get(a.id) ?? 0;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setEditing(a)}
                    data-testid="account-row"
                    className="flex min-h-[68px] w-full min-w-0 items-center gap-3 px-4 py-3 text-left active:bg-soft"
                  >
                    <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: a.color }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-semibold">{a.name}</span>
                      <span className="block truncate text-[13px] text-ink-3">
                        {T.accountTypes[a.type]}
                        {a.type === 'remunerat' && a.tae ? ` · ${t.taeLabel(formatPercent(a.tae, 2))}` : ''} · {t.movements(counts.get(a.id) ?? 0)}
                      </span>
                    </span>
                    <span className="min-w-0 shrink-0 text-right">
                      <span className="block text-[12px] text-ink-3">{t.balance}</span>
                      <span className={cn('money block text-[16px] font-semibold', balance < 0 && 'text-expense-ink')} data-testid="account-balance">
                        {formatEUR(balance)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      {editing && <AccountSheet key={editing === 'new' ? 'new' : editing.id} account={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function AccountSheet({ account, onClose }: { account: Account | null; onClose: () => void }) {
  const { accounts, transactions } = useStore();
  const { today } = useAppState();
  const toast = useToast();
  const [draft, setDraft] = useState<AccountDraft>(() =>
    account
      ? draftFromAccount(account)
      : { name: '', type: 'corrent', color: PALETTE[accounts.length % PALETTE.length], balance: '', date: today, tae: '', withholding: '19' },
  );
  const [errors, setErrors] = useState<FieldErrors<AccountField>>({});
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const own = useMemo(() => (account ? transactions.filter((tx) => tx.accountId === account.id || tx.toAccountId === account.id) : []), [account, transactions]);
  const earliest = own.reduce<string | null>((min, tx) => (min === null || tx.date < min ? tx.date : min), null);
  const isLast = accounts.length <= 1;

  const save = async () => {
    const { errors: next, data } = checkDraft(draft, earliest);
    setErrors(next);
    if (!data) return;
    setBusy(true);
    try {
      if (account) await updateAccount(account.id, data);
      else await createAccount(data);
      // A savings account dated in the past gets its finished months' interest right away.
      await runAutomation(today);
      toast(t.saved);
      onClose();
    } catch (e) {
      console.error(e);
      setBusy(false);
      toast(T.common.error, 'error');
    }
  };

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={account ? t.editTitle : t.newTitle}
        testId="account-sheet"
        footer={
          <div className="flex gap-3">
            {account && (
              <Button variant="dangerSoft" block onClick={() => setConfirmDelete(true)} data-testid="delete-account">
                {T.common.delete}
              </Button>
            )}
            <Button block onClick={save} disabled={busy} data-testid="save-account">
              {T.common.save}
            </Button>
          </div>
        }
      >
        <div className="pb-2">
          <AccountFields
            draft={draft}
            onChange={(patch) => {
              setDraft((d) => ({ ...d, ...patch }));
              setErrors({});
            }}
            errors={errors}
            today={today}
          />
        </div>
      </Sheet>
      {account && (
        <ConfirmDialog
          open={confirmDelete}
          title={t.deleteTitle(account.name)}
          confirmDisabled={isLast || (own.length > 0 && !acknowledged)}
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await deleteAccount(account.id);
            setConfirmDelete(false);
            toast(t.deleted);
            onClose();
          }}
          body={
            isLast ? (
              <p className="font-medium text-expense-ink">{t.lastAccount}</p>
            ) : own.length === 0 ? (
              t.deleteEmpty
            ) : (
              <div className="space-y-4">
                <p className="rounded-xl bg-expense-soft p-3 font-medium text-expense-ink" data-testid="delete-account-warning">
                  {t.deleteWithMovements(own.length)}
                </p>
                <label className="flex min-h-11 items-center gap-3 text-[15px] text-ink">
                  <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="h-6 w-6 shrink-0 accent-[#E11D48]" />
                  {t.deleteAcknowledge(own.length)}
                </label>
              </div>
            )
          }
        />
      )}
    </>
  );
}
