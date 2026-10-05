import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { getSession } from '@/server/auth/session';
import { listAccounts } from '@/server/services/accounts';
import { listCategories } from '@/server/services/categories';
import { generateDueForUser } from '@/server/services/recurring';
import { getMe, userToday } from '@/server/services/users';

/**
 * Authenticated area. Validates the session against the database on every full page load,
 * catches up recurring movements, and pre-fills the client cache with the data every screen
 * needs (profile, accounts, categories) so the first paint has no loading waterfall.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  const user = session.user;
  const today = userToday(user);

  try {
    await generateDueForUser(user.id, today);
  } catch (error) {
    console.error('[recurring] catch-up failed', error);
  }

  const [me, accounts, categories] = await Promise.all([getMe(user), listAccounts(user.id, today), listCategories(user.id)]);
  const client = new QueryClient();
  client.setQueryData(['me'], me);
  client.setQueryData(['accounts'], accounts);
  client.setQueryData(['categories'], categories);

  return (
    <HydrationBoundary state={dehydrate(client)}>
      <AppShell>{children}</AppShell>
    </HydrationBoundary>
  );
}
