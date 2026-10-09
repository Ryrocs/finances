import { twMerge } from 'tailwind-merge';

/** Joins class names; when two utilities conflict, the later one wins (e.g. `p-4` then `p-0`). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return twMerge(parts.filter(Boolean).join(' '));
}
