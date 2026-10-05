import type { Metadata } from 'next';
import { CategoriesView } from '@/components/views/CategoriesView';
import { getServerTranslator } from '@/server/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator();
  return { title: t('categoryAdmin.title') };
}

export default function Page() {
  return <CategoriesView />;
}
