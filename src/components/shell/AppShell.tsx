'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useI18n } from '@/components/providers/I18nProvider';
import { cn } from '@/components/ui/cn';
import { useMe } from '@/hooks/api';
import { localToday, monthOf } from '@/lib/dates';
import { Logo } from './Logo';
import { MonthProvider } from './MonthContext';
import { isActive, NAV_ITEMS } from './nav';
import { SheetsProvider, useSheets } from './Sheets';

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me } = useMe();
  const { locale, setLocale } = useI18n();

  // Follow the language saved in the profile (e.g. changed on another device).
  useEffect(() => {
    if (me && me.locale !== locale) void setLocale(me.locale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.locale]);

  return (
    <MonthProvider initialMonth={monthOf(me?.today ?? localToday())}>
      <SheetsProvider>
        <div className="min-h-dvh lg:pl-64">
          <Sidebar />
          <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-[var(--content-bottom)] sm:px-6 lg:px-10">
            {children}
          </main>
          <BottomNav />
          <Fab />
        </div>
      </SheetsProvider>
    </MonthProvider>
  );
}

function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { openNewMovement } = useSheets();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface px-4 py-6 lg:flex" aria-label={t('nav.mainNavigation')}>
      <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
        <Logo className="h-9 w-9" />
        <span className="text-lg font-bold tracking-tight">{t('common.appName')}</span>
      </Link>
      <button
        type="button"
        onClick={() => openNewMovement()}
        className="mb-6 flex h-12 items-center justify-center gap-2 rounded-2xl bg-brand font-semibold text-white shadow-float hover:bg-brand-strong"
      >
        <Plus className="h-5 w-5" aria-hidden />
        {t('nav.addMovement')}
      </button>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-12 items-center gap-3 rounded-2xl px-3 text-[15px] font-medium transition-colors',
                active ? 'bg-brand-soft text-brand-ink' : 'text-ink-2 hover:bg-surface-2',
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} aria-hidden />
              {t(item.label)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <nav
      aria-label={t('nav.mainNavigation')}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-safe backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto grid h-[var(--nav-height)] max-w-xl grid-cols-5 px-1">
        {NAV_ITEMS.filter((i) => i.mobile).map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-full min-w-0 flex-col items-center justify-center gap-1 px-0.5 transition-colors',
                  active ? 'text-brand' : 'text-ink-3 hover:text-ink-2',
                )}
              >
                <span className={cn('flex h-8 w-14 max-w-full items-center justify-center rounded-full transition-colors', active && 'bg-brand-soft')}>
                  <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} aria-hidden />
                </span>
                <span className={cn('w-full truncate text-center text-[11px] leading-none', active ? 'font-semibold' : 'font-medium')}>{t(item.label)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Fab() {
  const { t } = useI18n();
  const { openNewMovement } = useSheets();
  const pathname = usePathname();
  if (pathname.startsWith('/settings')) return null;
  return (
    <button
      type="button"
      onClick={() => openNewMovement()}
      aria-label={t('nav.addMovement')}
      className="fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-float transition-transform active:scale-95 lg:hidden"
      style={{ bottom: 'calc(var(--nav-height) + var(--safe-bottom) + 1rem)', right: 'calc(1rem + var(--safe-right))' }}
    >
      <Plus className="h-7 w-7" strokeWidth={2.4} aria-hidden />
    </button>
  );
}
