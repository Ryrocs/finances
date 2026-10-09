import { BarChart3, Home, Landmark, List, Menu, Plus } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { T } from '../texts';
import { SheetsProvider, useSheets } from './sheets/SheetsProvider';
import { cn } from './ui/cn';

export const TABS = [
  { to: '/', label: T.nav.dashboard, icon: Home, end: true },
  { to: '/moviments', label: T.nav.movements, icon: List, end: false },
  { to: '/analisi', label: T.nav.analysis, icon: BarChart3, end: false },
  { to: '/patrimoni', label: T.nav.wealth, icon: Landmark, end: false },
  { to: '/mes', label: T.nav.more, icon: Menu, end: false },
] as const;

/** The floating "+" is shown on the five main screens. */
const FAB_PATHS = new Set(['/', '/moviments', '/analisi', '/patrimoni', '/mes']);

export function Shell() {
  return (
    <SheetsProvider>
      <div className="min-h-dvh">
        <main className="mx-auto w-full max-w-[480px] px-4 pb-[var(--content-bottom)] pl-[max(16px,var(--safe-left))] pr-[max(16px,var(--safe-right))]">
          <Outlet />
        </main>
        <BottomNav />
        <Fab />
      </div>
    </SheetsProvider>
  );
}

function BottomNav() {
  return (
    <nav aria-label={T.nav.main} className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[var(--safe-bottom)] backdrop-blur-md">
      <ul className="mx-auto grid h-[var(--nav-height)] max-w-[480px] grid-cols-5">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="min-w-0">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn('flex h-full min-w-0 flex-col items-center justify-center gap-1 transition-colors', isActive ? 'text-ink' : 'text-ink-4')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="h-[23px] w-[23px]" strokeWidth={isActive ? 2.2 : 1.8} aria-hidden />
                  <span className={cn('w-full truncate px-0.5 text-center text-[11px] leading-none', isActive ? 'font-semibold' : 'font-medium')}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Fab() {
  const { pathname } = useLocation();
  const { openNew } = useSheets();
  if (!FAB_PATHS.has(pathname)) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 z-30 mx-auto max-w-[480px]" style={{ bottom: 'calc(var(--nav-height) + var(--safe-bottom) + 16px)' }}>
      <button
        type="button"
        onClick={() => openNew()}
        aria-label={T.nav.addMovement}
        data-testid="fab"
        className="pointer-events-auto absolute bottom-0 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-[0_6px_20px_rgb(0_0_0/0.22)] transition-transform active:scale-95"
        style={{ right: 'max(16px, var(--safe-right))' }}
      >
        <Plus className="h-7 w-7" strokeWidth={2.4} aria-hidden />
      </button>
    </div>
  );
}
