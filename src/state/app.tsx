import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { runAutomation } from '../db/automation';
import { currentMonth, today as localToday, type ISODate, type MonthKey } from '../lib/dates';

interface AppState {
  /** Today's local date; refreshed when the app comes back to the foreground or the day changes. */
  today: ISODate;
  /** Month shown by Resum, Moviments, Anàlisi and Pressupost. */
  month: MonthKey;
  setMonth: (month: MonthKey) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [today, setToday] = useState(localToday);
  const [month, setMonth] = useState(currentMonth);
  const lastToday = useRef(today);

  const refresh = useCallback(() => {
    const now = localToday();
    if (now === lastToday.current) return;
    const previous = lastToday.current;
    lastToday.current = now;
    setToday(now);
    // A new day may bring due recurring movements or a finished month's interest.
    void runAutomation(now).catch((e) => console.error(e));
    // Follow the calendar if the user was looking at the month that just ended.
    setMonth((m) => (m === previous.slice(0, 7) ? now.slice(0, 7) : m));
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const value = useMemo(() => ({ today, month, setMonth }), [today, month]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState outside AppStateProvider');
  return ctx;
}
