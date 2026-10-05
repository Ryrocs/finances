'use client';

import { useId, type ReactNode } from 'react';
import { cn } from './cn';

interface Option<T extends string> {
  value: T;
  label: ReactNode;
  activeClassName?: string;
}

/** Radio group styled as a segmented control (keyboard: arrows via native radios). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Option<T>[];
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex rounded-2xl bg-surface-2 p-1', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <label
            key={o.value}
            className={cn(
              'relative flex min-w-0 flex-1 cursor-pointer items-center justify-center rounded-xl px-1 text-center font-semibold tracking-tight transition-colors',
              size === 'sm' ? 'h-9 text-[13px]' : 'h-11 text-sm max-[400px]:text-[13px] max-[359px]:text-[12px]',
              active ? cn('bg-surface text-ink shadow-sm', o.activeClassName) : 'text-ink-3 hover:text-ink-2',
            )}
          >
            <input type="radio" name={name} value={o.value} checked={active} onChange={() => onChange(o.value)} className="sr-only" />
            <span className="truncate">{o.label}</span>
          </label>
        );
      })}
    </div>
  );
}
