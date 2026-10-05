import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import { AppProviders } from '@/components/providers/AppProviders';
import { ServiceWorker } from '@/components/shell/ServiceWorker';
import { loadMessages } from '@/lib/i18n/load';
import { getRequestLocale } from '@/server/locale';
import './globals.css';

const inter = localFont({
  src: './fonts/inter-latin-wght-normal.woff2',
  variable: '--font-inter',
  weight: '100 900',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Finances', template: '%s · Finances' },
  description: 'Personal finance: income, expenses, budgets and liquid net worth.',
  applicationName: 'Finances',
  appleWebApp: { capable: true, title: 'Finances', statusBarStyle: 'default' },
  formatDetection: { telephone: false, email: false, address: false },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f4f6f8',
  colorScheme: 'light',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getRequestLocale();
  const messages = await loadMessages(locale);
  return (
    <html lang={locale} className={inter.variable}>
      <body className="font-sans antialiased">
        <AppProviders locale={locale} messages={messages}>
          {children}
        </AppProviders>
        <ServiceWorker />
      </body>
    </html>
  );
}
