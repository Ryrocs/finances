import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

interface ToastState {
  id: number;
  message: string;
  tone: 'default' | 'error';
}

const ToastContext = createContext<(message: string, tone?: ToastState['tone']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((message: string, tone: ToastState['tone'] = 'default') => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), message, tone });
    timer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4"
        style={{ top: 'calc(var(--safe-top) + 12px)' }}
      >
        {toast && (
          <div
            key={toast.id}
            role="status"
            className={`max-w-[440px] animate-toast-in rounded-2xl px-4 py-3 text-[15px] font-medium text-white shadow-lg ${toast.tone === 'error' ? 'bg-expense-ink' : 'bg-primary'}`}
          >
            {toast.message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
