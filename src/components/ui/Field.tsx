'use client';

import { ChevronDown } from 'lucide-react';
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

export const fieldClasses =
  'block w-full rounded-field border border-transparent bg-surface-2 px-4 text-base text-ink placeholder:text-ink-4 outline-none transition-colors focus:border-brand focus:bg-surface aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger-soft/40';

interface FieldProps {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  optional?: string;
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode;
  className?: string;
}

/** Label + control + hint/error, wired for screen readers. */
export function Field({ label, error, hint, optional, children, className }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block px-1 text-sm font-medium text-ink-2">
        {label}
        {optional && <span className="font-normal text-ink-4"> · {optional}</span>}
      </label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': describedBy })}
      {error ? (
        <p id={`${id}-error`} role="alert" className="px-1 text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="px-1 text-[13px] leading-snug text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(fieldClasses, 'h-12', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(fieldClasses, 'min-h-24 py-3', className)} {...rest} />;
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(fieldClasses, 'h-12 appearance-none pr-10', className)} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3" aria-hidden />
    </div>
  );
}

export function Switch({ checked, onChange, label, description, id }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; id?: string }) {
  const autoId = useId();
  const switchId = id ?? autoId;
  return (
    <div className="flex items-center justify-between gap-4 rounded-field bg-surface-2 px-4 py-3">
      <div className="min-w-0">
        <label htmlFor={switchId} className="block text-[15px] font-medium text-ink">
          {label}
        </label>
        {description && <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{description}</p>}
      </div>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn('relative h-8 w-13 shrink-0 rounded-full transition-colors', checked ? 'bg-brand' : 'bg-line-strong')}
      >
        <span className={cn('absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all', checked ? 'left-6' : 'left-1')} />
      </button>
    </div>
  );
}
