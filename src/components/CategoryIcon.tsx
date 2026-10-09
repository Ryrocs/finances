import { ArrowLeftRight } from 'lucide-react';
import type { Category } from '../lib/types';
import { cn } from './ui/cn';

/** Round badge with the category emoji (or ⇄ for transfers), tinted with the category colour. */
export function CategoryIcon({ category, transfer = false, size = 'md' }: { category?: Category; transfer?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'sm' ? 'h-8 w-8 text-[16px]' : size === 'lg' ? 'h-12 w-12 text-[24px]' : 'h-10 w-10 text-[19px]';
  if (transfer) {
    return (
      <span className={cn('flex shrink-0 items-center justify-center rounded-full bg-transfer-soft text-transfer', dims)} aria-hidden>
        <ArrowLeftRight className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} strokeWidth={2.2} />
      </span>
    );
  }
  return (
    <span className={cn('flex shrink-0 items-center justify-center rounded-full leading-none', dims)} style={{ backgroundColor: `${category?.color ?? '#94A3B8'}22` }} aria-hidden>
      {category?.emoji ?? '🏷️'}
    </span>
  );
}
