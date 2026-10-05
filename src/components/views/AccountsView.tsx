'use client';

import { Plus, Wallet } from 'lucide-react';
import { useI18n } from '@/components/providers/I18nProvider';
import { PageHeader } from '@/components/shell/PageHeader';
import { useSheets } from '@/components/shell/Sheets';
import { Button } from '@/components/ui/Button';
import { Card, SectionTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import { useAccounts } from '@/hooks/api';
import { useFormat } from '@/hooks/useFormat';
import { AccountRow } from './NetWorthView';

export function AccountsView() {
  const { t } = useI18n();
  const f = useFormat();
  const { data: accounts = [] } = useAccounts();
  const { openAccount } = useSheets();
  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);

  return (
    <>
      <PageHeader
        title={t('accounts.title')}
        backHref="/settings"
        showSettings={false}
        actions={
          <Button size="sm" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => openAccount()}>
            {t('common.add')}
          </Button>
        }
      />
      <div className="mx-auto max-w-2xl">
        {accounts.length === 0 ? (
          <Card>
            <EmptyState
              icon={Wallet}
              title={t('accounts.emptyTitle')}
              text={t('accounts.emptyText')}
              action={<Button onClick={() => openAccount()}>{t('accounts.add')}</Button>}
            />
          </Card>
        ) : (
          <>
            <Card className="p-2 sm:p-2">
              <ul>
                {active.map((a) => (
                  <AccountRow key={a.id} account={a} share={null} onSelect={openAccount} />
                ))}
              </ul>
            </Card>
            <p className="mt-3 flex justify-between px-1 text-[14px] text-ink-2">
              <span>{t('netWorth.totalLiquid')}</span>
              <span className="font-semibold tabular">{f.money(active.filter((a) => a.isLiquid).reduce((s, a) => s + a.balanceCents, 0))}</span>
            </p>
            {archived.length > 0 && (
              <>
                <SectionTitle>{t('common.archived')}</SectionTitle>
                <Card className="p-2 opacity-80 sm:p-2">
                  <ul>
                    {archived.map((a) => (
                      <AccountRow key={a.id} account={a} share={null} onSelect={openAccount} />
                    ))}
                  </ul>
                </Card>
                <p className="mt-2 px-1 text-[13px] text-ink-3">{t('accounts.archivedHint')}</p>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
