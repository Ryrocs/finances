import { LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft' | 'dark' | 'link';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'square';

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-strong active:bg-brand-strong disabled:bg-brand/50',
  dark: 'bg-ink text-white hover:bg-ink/90 disabled:bg-ink/50',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2 active:bg-surface-3 disabled:text-ink-4',
  soft: 'bg-surface-2 text-ink hover:bg-surface-3 active:bg-surface-3 disabled:text-ink-4',
  ghost: 'bg-transparent text-ink-2 hover:bg-surface-2 active:bg-surface-3 disabled:text-ink-4',
  danger: 'bg-danger-soft text-danger hover:bg-danger/15 active:bg-danger/20 disabled:opacity-50',
  link: 'bg-transparent text-brand hover:bg-brand-soft active:bg-brand-soft disabled:text-ink-4',
};

const sizes: Record<Size, string> = {
  sm: 'h-10 px-3.5 text-sm rounded-xl gap-1.5',
  md: 'h-12 px-4 text-[15px] rounded-2xl gap-2',
  lg: 'h-14 px-5 text-base rounded-2xl gap-2',
  icon: 'h-11 w-11 rounded-full',
  square: 'h-12 w-12 rounded-2xl',
};

export function buttonClasses({ variant = 'primary', size = 'md', block = false, className }: { variant?: Variant; size?: Size; block?: boolean; className?: string } = {}) {
  return cn(
    'inline-flex shrink-0 select-none items-center justify-center font-semibold transition-colors disabled:cursor-not-allowed',
    variants[variant],
    sizes[size],
    block && 'w-full',
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({ variant, size, block, loading, icon, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, block, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

export function ButtonLink({ variant, size, block, className, ...rest }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; block?: boolean }) {
  return <Link className={buttonClasses({ variant, size, block, className })} {...rest} />;
}
