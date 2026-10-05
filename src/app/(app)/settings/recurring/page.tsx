import type { Metadata } from 'next';
import { RecurringView } from '@/components/views/RecurringView';
import { getServerTranslator } from '@/server/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator();
  return { title: t('recurring.title') };
}

export default function Page() {
  return <RecurringView />;
}
