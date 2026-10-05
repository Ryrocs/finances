import 'server-only';
import { loadMessages } from '@/lib/i18n/load';
import { createTranslator } from '@/lib/i18n/translate';
import { getRequestLocale } from './locale';

/** Translator for Server Components (metadata, server-rendered text). */
export async function getServerTranslator() {
  const locale = await getRequestLocale();
  return createTranslator(locale, await loadMessages(locale));
}
