import type { Metadata } from 'next';
import { NetWorthView } from '@/components/views/NetWorthView';
import { getServerTranslator } from '@/server/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator();
  return { title: t('netWorth.title') };
}

export default function NetWorthPage() {
  return <NetWorthView />;
}
