import { ChevronRight, Database, Landmark, Repeat, Tags, Target, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/ui/Card';
import { diffDays, today as localToday } from '../lib/dates';
import { useAppState } from '../state/app';
import { useStore } from '../state/data';
import { T } from '../texts';

const t = T.more;

const ITEMS = [
  { to: '/mes/pressupost', label: t.budget, hint: t.budgetHint, icon: Target },
  { to: '/mes/comptes', label: t.accounts, hint: t.accountsHint, icon: Landmark },
  { to: '/mes/categories', label: t.categories, hint: t.categoriesHint, icon: Tags },
  { to: '/mes/recurrents', label: t.recurring, hint: t.recurringHint, icon: Repeat },
  { to: '/mes/dades', label: t.data, hint: t.dataHint, icon: Database },
];

/** Days since the last backup (null = never). */
export function daysSinceBackup(lastBackupAt: number | undefined, today: string): number | null {
  if (!lastBackupAt) return null;
  return Math.max(0, diffDays(localToday(new Date(lastBackupAt)), today));
}

export function MorePage() {
  const { settings } = useStore();
  const { today } = useAppState();
  const days = daysSinceBackup(settings.lastBackupAt, today);
  const backupWarning = days === null ? t.backupNever : days > 30 ? t.backupOld(days) : null;

  return (
    <>
      <PageHeader title={t.title} />
      <div className="space-y-3">
        {backupWarning && (
          <Link
            to="/mes/dades"
            className="flex items-center gap-3 rounded-card border border-warning/40 bg-warning-soft px-4 py-3 text-[14px] text-warning-ink"
            data-testid="backup-warning"
          >
            <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">{backupWarning}</span>
            <span className="shrink-0 font-semibold">{t.backupAction}</span>
          </Link>
        )}
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-line">
            {ITEMS.map(({ to, label, hint, icon: Icon }) => (
              <li key={to}>
                <Link to={to} className="flex min-h-[64px] items-center gap-3.5 px-4 py-3 active:bg-soft">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-soft text-ink">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-semibold">{label}</span>
                    <span className="block truncate text-[13px] text-ink-3">{hint}</span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-ink-4" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <p className="px-1 pt-2 text-center text-[12px] text-ink-4">
          {T.appName} · {t.version(__APP_VERSION__)}
        </p>
      </div>
    </>
  );
}
