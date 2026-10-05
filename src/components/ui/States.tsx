'use client';

import { CircleAlert, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useI18n } from '@/components/providers/I18nProvider';
import { ApiClientError } from '@/lib/api-client';
import { Button } from './Button';
import { cn } from './cn';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-surface-3/70', className)} aria-hidden />;
}

/** Generic page skeleton: hero + cards. Announces loading to screen readers. */
export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  const { t } = useI18n();
  return (
    <div className="space-y-4" role="status" aria-label={t('common.loading')}>
      <Skeleton className="h-36 rounded-card" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-card" />
        <Skeleton className="h-24 rounded-card" />
      </div>
      {Array.from({ length: cards }, (_, i) => (
        <Skeleton key={i} className="h-44 rounded-card" />
      ))}
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  text?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-4 py-10 text-center', className)}>
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-soft text-brand">
        <Icon className="h-8 w-8" aria-hidden />
      </div>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {text && <p className="mt-1.5 max-w-sm text-[15px] leading-relaxed text-ink-3">{text}</p>}
      {action && <div className="mt-5 flex w-full max-w-xs flex-col gap-2">{action}</div>}
    </div>
  );
}

/** Translates any error thrown by the API client into a user-facing message. */
export function useErrorMessage() {
  const { t, tDynamic } = useI18n();
  return (error: unknown) =>
    error instanceof ApiClientError ? tDynamic(`errors.${error.code}`, t('errors.server_error')) : t('errors.server_error');
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t, tDynamic } = useI18n();
  const message = error instanceof ApiClientError ? tDynamic(`errors.${error.code}`, t('errors.loadFailed')) : t('errors.loadFailed');
  return (
    <div role="alert" className="flex flex-col items-center rounded-card border border-line bg-surface px-5 py-8 text-center shadow-card">
      <CircleAlert className="mb-3 h-8 w-8 text-danger" aria-hidden />
      <p className="font-semibold text-ink">{t('errors.genericTitle')}</p>
      <p className="mt-1 max-w-sm text-sm text-ink-3">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  size = 'md',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'brand' | 'warning' | 'danger' | 'income' | 'transfer';
  size?: 'sm' | 'md';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-surface-2 text-ink-2',
    brand: 'bg-brand-soft text-brand-ink',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
    income: 'bg-income-soft text-income',
    transfer: 'bg-transfer-soft text-transfer',
  };
  const sizes = { sm: 'px-1.5 text-[10px] leading-4', md: 'px-2 py-0.5 text-[11px]' };
  return <span className={cn('inline-flex items-center gap-1 rounded-full font-semibold', sizes[size], tones[tone], className)}>{children}</span>;
}

/** Budget-style meter. `value` is a percentage (may exceed 100). */
export function ProgressBar({ value, level, label }: { value: number; level: 'ok' | 'warning' | 'exceeded'; label?: string }) {
  const color = level === 'exceeded' ? 'bg-danger' : level === 'warning' ? 'bg-warning-mark' : 'bg-brand';
  const track = level === 'exceeded' ? 'bg-danger-soft' : level === 'warning' ? 'bg-warning-soft' : 'bg-brand-soft';
  return (
    <div
      className={cn('h-2.5 w-full overflow-hidden rounded-full', track)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.min(100, Math.round(value))}
      aria-label={label}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500', color)} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  );
}
