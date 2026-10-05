'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useI18n } from '@/components/providers/I18nProvider';
import { cn } from './cn';

/**
 * Bottom sheet on phones, centred dialog from `sm` up. Built on native <dialog> (focus trap,
 * Escape, top layer). It follows the visual viewport so the footer stays above the keyboard.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { t } = useI18n();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Keyboard-aware sizing (iOS Safari doesn't resize the layout viewport for the keyboard).
  useEffect(() => {
    if (!open || typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const dialog = ref.current;
    const update = () => {
      if (!dialog) return;
      const keyboard = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      dialog.style.setProperty('--kb', `${keyboard}px`);
      dialog.style.setProperty('--vvh', `${vv.height}px`);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy ?? titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself, outside the panel) closes.
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        'fixed m-0 w-full max-w-none bg-transparent p-0 text-ink backdrop:bg-ink/45',
        'inset-x-0 top-auto bottom-[var(--kb,0px)] max-h-[calc(var(--vvh,100dvh)-var(--safe-top)-0.75rem)]',
        'sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[min(88dvh,52rem)]',
        size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        'open:flex open:flex-col',
      )}
    >
      <div
        className={cn(
          'flex max-h-[inherit] min-h-0 flex-1 flex-col overflow-hidden bg-surface shadow-sheet',
          'rounded-t-[1.75rem] animate-sheet-up sm:rounded-[1.75rem] sm:animate-fade-in',
        )}
      >
        <div className="relative shrink-0 px-5 pb-2 pt-3 max-[359px]:px-4">
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-line-strong sm:hidden" aria-hidden />
          <div className="flex items-center justify-between gap-3">
            <h2 id={titleId} className="min-w-0 truncate text-lg font-semibold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2"
              aria-label={t('common.close')}
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 max-[359px]:px-4">{open && children}</div>
        {footer && (
          <div className="shrink-0 border-t border-line bg-surface px-5 pt-3 pb-[max(0.75rem,var(--safe-bottom))] max-[359px]:px-4">
            {footer}
          </div>
        )}
      </div>
    </dialog>
  );
}
