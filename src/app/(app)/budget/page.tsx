import type { Metadata } from 'next';
import { BudgetView } from '@/components/views/BudgetView';
import { getServerTranslator } from '@/server/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator();
  return { title: t('budget.title') };
}

export default function BudgetPage() {
  return <BudgetView />;
}
