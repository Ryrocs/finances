import type { Metadata } from 'next';
import { DashboardView } from '@/components/views/DashboardView';
import { getServerTranslator } from '@/server/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator();
  return { title: t('nav.dashboard') };
}

export default function DashboardPage() {
  return <DashboardView />;
}
