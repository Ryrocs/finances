import type { ReactNode } from 'react';
import { cn } from './cn';

export function EmptyState({ icon, title, hint, action, className }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center px-4 py-8 text-center', className)}>
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-soft text-[22px] text-ink-3">{icon}</div>}
      <p className="text-[15px] font-semibold text-ink-2">{title}</p>
      {hint && <p className="mt-1 max-w-[300px] text-[14px] text-ink-3">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
