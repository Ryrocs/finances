import Link from 'next/link';
import { getServerTranslator } from '@/server/i18n';

export default async function NotFound() {
  const { t } = await getServerTranslator();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-5xl font-bold text-ink-4">404</p>
      <p className="mt-3 text-lg font-semibold">{t('errors.not_found')}</p>
      <Link href="/" className="mt-6 inline-flex h-12 items-center rounded-2xl bg-brand px-5 font-semibold text-white">
        {t('nav.dashboard')}
      </Link>
    </main>
  );
}
