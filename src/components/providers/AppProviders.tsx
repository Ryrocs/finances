'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/Toast';
import { ApiClientError } from '@/lib/api-client';
import type { Messages } from '@/lib/i18n/messages/en';
import type { Locale } from '@/lib/types';
import { I18nProvider } from './I18nProvider';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: true,
        retry: (count, error) => {
          // Client errors (401/403/404/validation) won't fix themselves.
          if (error instanceof ApiClientError && error.status >= 400 && error.status < 500) return false;
          return count < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}

export function AppProviders({ locale, messages, children }: { locale: Locale; messages: Messages; children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={client}>
      <I18nProvider locale={locale} messages={messages}>
        <ToastProvider>{children}</ToastProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
