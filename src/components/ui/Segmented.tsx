import { cn } from './cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Full name for screen readers when `label` is abbreviated. */
  ariaLabel?: string;
  /** Tailwind classes applied when this option is active (e.g. a semantic colour). */
  activeClass?: string;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: {
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex min-w-0 gap-1 rounded-2xl bg-soft p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.ariaLabel}
            title={o.ariaLabel}
            onClick={() => onChange(o.value)}
            className={cn(
              'min-w-0 flex-1 truncate rounded-xl px-1 font-semibold transition-colors',
              size === 'md' ? 'h-11 text-[15px] max-[400px]:text-[14px] max-[400px]:tracking-tight' : 'h-11 text-[13px]',
              active ? (o.activeClass ?? 'bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]') : 'text-ink-3 active:bg-soft-2',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
