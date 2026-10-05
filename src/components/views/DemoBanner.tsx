'use client';

import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useI18n } from '@/components/providers/I18nProvider';
import { useMe } from '@/hooks/api';

/** Clearly identifies demo data on the main screens. */
export function DemoBanner() {
  const { t } = useI18n();
  const { data: me } = useMe();
  if (!me?.hasDemoData) return null;
  return (
    <div role="note" className="mb-4 flex items-center gap-3 rounded-2xl border border-warning-mark/30 bg-warning-soft px-4 py-2.5 text-[14px] text-warning">
      <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 leading-snug">{t('dashboard.demoBanner')}</p>
      <Link href="/settings#demo" className="shrink-0 rounded-lg px-1 py-1 font-semibold underline underline-offset-2">
        {t('dashboard.removeDemo')}
      </Link>
    </div>
  );
}
