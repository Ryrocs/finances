import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { db } from '../db/db';
import type { Account, Budget, Category, RecurringRule, SettingsMap, Transaction } from '../lib/types';

export interface Store {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  rules: RecurringRule[];
  budgets: Budget[];
  settings: Partial<SettingsMap>;
  accountById: Map<string, Account>;
  categoryById: Map<string, Category>;
}

const DataContext = createContext<Store | null>(null);

/**
 * Live view of the whole database. Personal finance data is small (thousands of rows), so keeping
 * it in memory and deriving everything with plain functions is simple and fast. Any write to
 * IndexedDB refreshes every screen (dashboards and charts included) automatically.
 */
export function DataProvider({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const raw = useLiveQuery(async () => {
    const [accounts, categories, transactions, rules, budgets, settingRows] = await Promise.all([
      db.accounts.orderBy('order').toArray(),
      db.categories.orderBy('order').toArray(),
      db.transactions.toArray(),
      db.recurringRules.toArray(),
      db.budgets.toArray(),
      db.settings.toArray(),
    ]);
    return { accounts, categories, transactions, rules, budgets, settingRows };
  }, []);

  const store = useMemo<Store | null>(() => {
    if (!raw) return null;
    return {
      accounts: raw.accounts,
      categories: raw.categories,
      transactions: raw.transactions,
      rules: raw.rules,
      budgets: raw.budgets,
      settings: Object.fromEntries(raw.settingRows.map((r) => [r.key, r.value])) as Partial<SettingsMap>,
      accountById: new Map(raw.accounts.map((a) => [a.id, a])),
      categoryById: new Map(raw.categories.map((c) => [c.id, c])),
    };
  }, [raw]);

  if (!store) return <>{fallback ?? null}</>;
  return <DataContext.Provider value={store}>{children}</DataContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(DataContext);
  if (!store) throw new Error('useStore outside DataProvider');
  return store;
}
