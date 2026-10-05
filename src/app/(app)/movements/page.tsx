import type { Metadata } from 'next';
import { MovementsView } from '@/components/views/MovementsView';
import { getServerTranslator } from '@/server/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator();
  return { title: t('movements.title') };
}

export default function MovementsPage() {
  return <MovementsView />;
}
