import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/views/AuthForm';
import { getSession } from '@/server/auth/session';
import { getServerTranslator } from '@/server/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator();
  return { title: t('auth.signupButton') };
}

export default async function Page() {
  if (await getSession()) redirect('/');
  return <AuthForm mode="signup" />;
}
