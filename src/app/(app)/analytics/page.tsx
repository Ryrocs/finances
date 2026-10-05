import type { Metadata } from 'next';
import { AnalyticsView } from '@/components/views/AnalyticsView';
import { getServerTranslator } from '@/server/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator();
  return { title: t('analytics.title') };
}

export default function AnalyticsPage() {
  return <AnalyticsView />;
}
