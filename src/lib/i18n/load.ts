import type { Locale } from '../types';
import type { Messages } from './messages/en';

/** Loads one dictionary (code-split per language on the client). */
export async function loadMessages(locale: Locale): Promise<Messages> {
  switch (locale) {
    case 'es':
      return (await import('./messages/es')).default;
    case 'en':
      return (await import('./messages/en')).default;
    default:
      return (await import('./messages/ca')).default;
  }
}
