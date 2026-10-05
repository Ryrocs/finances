import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-card border border-line/70 bg-surface p-4 shadow-card sm:p-5', className)} {...rest} />;
}

export function CardHeader({ title, subtitle, action, id }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="text-[17px] font-semibold leading-snug text-ink">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between gap-3 px-1 first:mt-0">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">{children}</h2>
      {action}
    </div>
  );
}
