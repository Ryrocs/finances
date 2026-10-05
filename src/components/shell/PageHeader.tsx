'use client';

import { ChevronLeft, Settings } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useI18n } from '@/components/providers/I18nProvider';
import { Logo } from './Logo';

/**
 * Screen header. Phones: sticky, respects the notch/status bar, settings shortcut on the right
 * (Settings isn't in the tab bar). Desktop: plain title row.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  backHref,
  showSettings = true,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  showSettings?: boolean;
}) {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-20 -mx-4 mb-4 bg-page/90 px-4 pt-safe backdrop-blur-md sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:mb-6 lg:bg-transparent lg:px-0 lg:pt-8 lg:backdrop-blur-none">
      <div className="flex min-h-16 items-center gap-2 py-2">
        {backHref ? (
          <Link href={backHref} className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2" aria-label={t('common.back')}>
            <ChevronLeft className="h-6 w-6" aria-hidden />
          </Link>
        ) : (
          <Logo className="h-8 w-8 shrink-0 lg:hidden" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-bold leading-tight tracking-tight lg:text-[28px]">{title}</h1>
          {subtitle && <p className="truncate text-[13px] text-ink-3 lg:text-sm">{subtitle}</p>}
        </div>
        {actions}
        {showSettings && (
          <Link
            href="/settings"
            className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 lg:hidden"
            aria-label={t('nav.settings')}
          >
            <Settings className="h-[22px] w-[22px]" aria-hidden />
          </Link>
        )}
      </div>
    </header>
  );
}
