import type { Metadata } from 'next';
import { SettingsView } from '@/components/views/SettingsView';
import { getServerTranslator } from '@/server/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator();
  return { title: t('settings.title') };
}

export default function SettingsPage() {
  return <SettingsView />;
}
