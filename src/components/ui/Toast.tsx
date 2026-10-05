'use client';

import { CircleCheck, CircleAlert, TriangleAlert, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '@/components/providers/I18nProvider';
import { cn } from './cn';

type ToastKind = 'success' | 'error' | 'warning';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<{ show: (message: string, kind?: ToastKind) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const show = useCallback(
    (message: string, kind: ToastKind = 'success') => {
      const id = nextId.current++;
      setItems((list) => [...list.slice(-2), { id, kind, message }]);
      setTimeout(() => dismiss(id), kind === 'success' ? 3200 : 6000);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ show }), [show]);
  const container = useRef<HTMLDivElement>(null);

  // Render toasts in the top layer (popover) so they appear above open sheets/dialogs.
  useEffect(() => {
    const el = container.current;
    if (!el || typeof el.showPopover !== 'function') return;
    try {
      if (el.matches(':popover-open')) el.hidePopover();
      if (items.length) el.showPopover();
    } catch {
      // popover unsupported — the fixed container still works outside dialogs
    }
  }, [items]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        ref={container}
        popover="manual"
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 top-0 bottom-auto z-[60] m-0 flex w-full max-w-none flex-col items-center gap-2 overflow-visible border-0 bg-transparent px-4 pt-[calc(var(--safe-top)+0.75rem)]"
      >
        {items.map((item) => {
          const Icon = item.kind === 'success' ? CircleCheck : item.kind === 'warning' ? TriangleAlert : CircleAlert;
          return (
            <div
              key={item.id}
              role={item.kind === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full max-w-md animate-toast-in items-start gap-3 rounded-2xl bg-ink px-4 py-3 text-[15px] text-white shadow-lg"
            >
              <Icon
                className={cn('mt-0.5 h-5 w-5 shrink-0', item.kind === 'success' ? 'text-emerald-300' : item.kind === 'warning' ? 'text-amber-300' : 'text-rose-300')}
                aria-hidden
              />
              <p className="min-w-0 flex-1 leading-snug">{item.message}</p>
              <button type="button" onClick={() => dismiss(item.id)} className="-m-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/70" aria-label={t('common.close')}>
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
