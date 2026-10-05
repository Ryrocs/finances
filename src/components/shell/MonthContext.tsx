'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

const MonthContext = createContext<{ month: string; setMonth: (m: string) => void } | null>(null);

/** Selected month shared by Dashboard, Movements and Budget (defaults to the current month). */
export function MonthProvider({ initialMonth, children }: { initialMonth: string; children: ReactNode }) {
  const [month, setMonth] = useState(initialMonth);
  return <MonthContext.Provider value={{ month, setMonth }}>{children}</MonthContext.Provider>;
}

export function useMonth() {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error('useMonth must be used inside <MonthProvider>');
  return ctx;
}
