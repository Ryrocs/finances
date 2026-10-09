import { ChevronDown } from 'lucide-react';
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

/** Label + control + error message under the field. */
export function Field({
  label,
  error,
  hint,
  children,
  htmlFor,
  className,
  trailing,
}: {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[14px] font-medium text-ink-2">
          {label}
        </label>
        {trailing}
      </div>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-[13px] font-medium text-expense-ink">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-[13px] text-ink-3">{hint}</p>
      )}
    </div>
  );
}

const control =
  'block h-12 w-full min-w-0 rounded-xl border bg-surface px-3.5 text-[16px] text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-ink-3';

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function TextInput(
  { className, invalid, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(control, invalid ? 'border-expense' : 'border-line-strong', className)} {...rest} />;
});

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, 'h-auto min-h-[88px] py-3 border-line-strong', className)} {...rest} />;
}

export function Select({ className, invalid, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <div className="relative min-w-0">
      <select className={cn(control, 'pr-10', invalid ? 'border-expense' : 'border-line-strong', className)} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3" aria-hidden />
    </div>
  );
}

export function useFieldId(prefix: string) {
  return `${prefix}-${useId().replace(/:/g, '')}`;
}
