import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('min-w-0 rounded-card border border-line bg-surface p-4', className)} {...rest} />;
}

export function CardTitle({ children, action, subtitle }: { children: ReactNode; action?: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold leading-snug text-ink">{children}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-3">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between gap-3 px-1">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">{children}</h2>
      {action}
    </div>
  );
}
