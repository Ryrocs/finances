import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { T } from '../texts';

export function PageHeader({ title, back, action }: { title: string; back?: string; action?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="pb-3" style={{ paddingTop: 'calc(var(--safe-top) + 16px)' }}>
      {back && (
        <button
          type="button"
          onClick={() => navigate(back)}
          className="-ml-2 mb-1 flex h-11 items-center gap-0.5 rounded-xl pr-3 text-[16px] font-medium text-ink-2 active:bg-soft"
        >
          <ChevronLeft className="h-6 w-6" aria-hidden />
          {T.nav.more}
          <span className="sr-only">{T.common.back}</span>
        </button>
      )}
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-[30px] font-bold leading-tight tracking-tight">{title}</h1>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
