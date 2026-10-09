import type { ReactNode } from 'react';
import { cn } from '../ui/cn';

export function ChipGroup({ label, children, invalid }: { label: string; children: ReactNode; invalid?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} aria-invalid={invalid || undefined} className="flex flex-wrap gap-2">
      {children}
    </div>
  );
}

export function chipClass(selected: boolean): string {
  return cn(
    'inline-flex h-11 min-w-0 max-w-full items-center gap-1.5 rounded-full border px-3.5 text-[15px] font-medium transition-colors disabled:opacity-40',
    selected ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink active:bg-soft',
  );
}

export function Chip({
  selected,
  onClick,
  children,
  testId,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  testId?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={chipClass(selected)}
    >
      {children}
    </button>
  );
}
