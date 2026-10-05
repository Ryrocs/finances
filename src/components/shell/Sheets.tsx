'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AccountSheet } from '@/components/forms/AccountSheet';
import { MovementSheet } from '@/components/forms/MovementSheet';
import type { AccountDTO, TransactionDTO, TransactionType } from '@/lib/types';

interface SheetsContextValue {
  openNewMovement: (type?: TransactionType) => void;
  openEditMovement: (tx: TransactionDTO) => void;
  openAccount: (account?: AccountDTO) => void;
}

const SheetsContext = createContext<SheetsContextValue | null>(null);

type MovementState = { open: false } | { open: true; type: TransactionType; tx?: TransactionDTO; key: number };
type AccountState = { open: false } | { open: true; account?: AccountDTO; key: number };

/** App-wide sheets so "+ Add movement" and "New account" work from any screen. */
export function SheetsProvider({ children }: { children: ReactNode }) {
  const [movement, setMovement] = useState<MovementState>({ open: false });
  const [account, setAccount] = useState<AccountState>({ open: false });

  const openNewMovement = useCallback((type: TransactionType = 'expense') => setMovement({ open: true, type, key: Date.now() }), []);
  const openEditMovement = useCallback((tx: TransactionDTO) => setMovement({ open: true, type: tx.type, tx, key: Date.now() }), []);
  const openAccount = useCallback((acc?: AccountDTO) => setAccount({ open: true, account: acc, key: Date.now() }), []);
  const value = useMemo(() => ({ openNewMovement, openEditMovement, openAccount }), [openNewMovement, openEditMovement, openAccount]);

  return (
    <SheetsContext.Provider value={value}>
      {children}
      <MovementSheet
        key={movement.open ? movement.key : 'closed'}
        open={movement.open}
        initialType={movement.open ? movement.type : 'expense'}
        transaction={movement.open ? movement.tx : undefined}
        onClose={() => setMovement({ open: false })}
        onCreateAccount={() => {
          setMovement({ open: false });
          openAccount();
        }}
      />
      <AccountSheet
        key={account.open ? account.key : 'closed-account'}
        open={account.open}
        account={account.open ? account.account : undefined}
        onClose={() => setAccount({ open: false })}
      />
    </SheetsContext.Provider>
  );
}

export function useSheets() {
  const ctx = useContext(SheetsContext);
  if (!ctx) throw new Error('useSheets must be used inside <SheetsProvider>');
  return ctx;
}
