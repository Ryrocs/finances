import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'danger' | 'dangerSoft' | 'dangerOutline' | 'ghost' | 'outline';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white active:bg-black/80 disabled:bg-ink-4',
  secondary: 'bg-soft text-ink active:bg-soft-2 disabled:text-ink-4',
  outline: 'border border-line-strong bg-surface text-ink active:bg-soft disabled:text-ink-4',
  danger: 'bg-expense-ink text-white active:bg-expense disabled:opacity-50',
  dangerSoft: 'bg-soft text-expense-ink active:bg-soft-2 disabled:opacity-50',
  dangerOutline: 'border border-line-strong bg-surface text-expense-ink active:bg-soft disabled:opacity-50',
  ghost: 'bg-transparent text-ink-2 active:bg-soft disabled:text-ink-4',
};

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  className,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; block?: boolean }) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl font-semibold transition-colors disabled:cursor-not-allowed',
        size === 'sm' && 'h-11 px-4 text-[15px]',
        size === 'md' && 'h-12 px-5 text-[16px]',
        size === 'lg' && 'h-14 px-6 text-[17px]',
        block && 'w-full',
        variants[variant],
        className,
      )}
      {...rest}
    />
  );
}

export function IconButton({ className, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn('inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors active:bg-soft-2', className)}
      {...rest}
    />
  );
}
