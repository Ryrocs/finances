import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { T } from '../../texts';
import { cn } from './cn';

/**
 * Bottom sheet built on the native <dialog> (top layer: always above the tab bar and the floating
 * button; focus trap and Escape for free). The footer — where "Guardar" lives — is outside the
 * scrolling area, padded for the iPhone home indicator and lifted above the on-screen keyboard.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  header,
  testId,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Extra content pinned under the title (e.g. the type selector). */
  header?: ReactNode;
  testId?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // iOS Safari doesn't resize the layout viewport for the keyboard: follow the visual viewport so
  // the footer stays visible above it.
  useEffect(() => {
    if (!open || !window.visualViewport) return;
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
      aria-labelledby={titleId}
      data-testid={testId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        'fixed inset-x-0 top-auto bottom-[var(--kb,0px)] m-0 mx-auto w-full max-w-[480px] bg-transparent p-0 text-ink',
        'max-h-[calc(var(--vvh,100dvh)-var(--safe-top)-12px)] open:flex open:flex-col',
      )}
    >
      <div className="flex max-h-[inherit] min-h-0 flex-1 animate-sheet-up flex-col overflow-hidden rounded-t-[24px] bg-surface">
        <div className="shrink-0 px-5 pt-2.5">
          <div className="mx-auto mb-1.5 h-1.5 w-10 rounded-full bg-line-strong" aria-hidden />
          <div className="flex items-center justify-between gap-3">
            <h2 id={titleId} className="min-w-0 truncate text-[19px] font-bold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={T.common.close}
              className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 active:bg-soft"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          {header && <div className="pb-3 pt-1">{header}</div>}
        </div>
        <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-1', footer ? 'pb-4' : 'pb-[max(20px,var(--safe-bottom))]')}>
          {open && children}
        </div>
        {footer && <div className="shrink-0 border-t border-line bg-surface px-5 pt-3 pb-[max(12px,var(--safe-bottom))]">{footer}</div>}
      </div>
    </dialog>
  );
}
