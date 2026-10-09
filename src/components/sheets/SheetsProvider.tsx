import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { RecurringRule, Transaction, TransactionType } from '../../lib/types';
import { MovementDetail } from './MovementDetail';
import { MovementForm, type FormMode } from './MovementForm';

interface Sheets {
  /** "Afegir moviment". */
  openNew: (type?: TransactionType) => void;
  openEdit: (tx: Transaction) => void;
  openRule: (rule: RecurringRule) => void;
  openDetail: (tx: Transaction) => void;
}

const SheetsContext = createContext<Sheets | null>(null);

export function SheetsProvider({ children }: { children: ReactNode }) {
  const [form, setForm] = useState<{ mode: FormMode; key: number } | null>(null);
  const [detail, setDetail] = useState<Transaction | null>(null);
  const keyboardProxy = useRef<HTMLInputElement>(null);

  const openNew = useCallback((type?: TransactionType) => {
    // iOS only opens the keyboard for a focus() made during the tap itself. Focus a hidden
    // numeric input now; the sheet then moves the focus to the amount field and the keyboard stays.
    keyboardProxy.current?.focus({ preventScroll: true });
    setDetail(null);
    setForm({ mode: { kind: 'new', type }, key: Date.now() });
  }, []);
  const openEdit = useCallback((tx: Transaction) => {
    setDetail(null);
    setForm({ mode: { kind: 'edit', tx }, key: Date.now() });
  }, []);
  const openRule = useCallback((rule: RecurringRule) => setForm({ mode: { kind: 'rule', rule }, key: Date.now() }), []);
  const openDetail = useCallback((tx: Transaction) => setDetail(tx), []);

  const value = useMemo(() => ({ openNew, openEdit, openRule, openDetail }), [openNew, openEdit, openRule, openDetail]);

  return (
    <SheetsContext.Provider value={value}>
      {children}
      <input
        ref={keyboardProxy}
        aria-hidden
        tabIndex={-1}
        type="text"
        inputMode="decimal"
        className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
        style={{ fontSize: 16 }}
      />
      {detail && <MovementDetail key={detail.id} tx={detail} onClose={() => setDetail(null)} onEdit={openEdit} />}
      {form && <MovementForm key={form.key} mode={form.mode} onClose={() => setForm(null)} />}
    </SheetsContext.Provider>
  );
}

export function useSheets(): Sheets {
  const ctx = useContext(SheetsContext);
  if (!ctx) throw new Error('useSheets outside SheetsProvider');
  return ctx;
}
