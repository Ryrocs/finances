import { createContext, useContext, type ReactNode } from 'react';

interface Sheets {
  openNew: () => void;
}

const SheetsContext = createContext<Sheets>({ openNew: () => {} });

export function SheetsProvider({ children }: { children: ReactNode }) {
  return <SheetsContext.Provider value={{ openNew: () => {} }}>{children}</SheetsContext.Provider>;
}

export function useSheets() {
  return useContext(SheetsContext);
}
