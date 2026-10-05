import type { Metadata } from 'next';
import { AccountsView } from '@/components/views/AccountsView';
import { getServerTranslator } from '@/server/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator();
  return { title: t('accounts.title') };
}

export default function Page() {
  return <AccountsView />;
}
