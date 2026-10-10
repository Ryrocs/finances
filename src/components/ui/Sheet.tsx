import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { T } from '../../texts';
import { cn } from './cn';

/**
 * Bottom sheet built on the native <dialog> (top layer: always above the tab bar and the floating
 * button; focus trap and Escape for free). The footer — where "Guardar" lives — is outside the
 * scrolling area and padded for the iPhone home indicator.
 *
 * On-screen keyboard: the dialog is a transparent layer that covers exactly the *visible* part of
 * the screen (the visual viewport) and the sheet sits at its bottom, so it always ends right above
 * the keyboard. This only relies on visualViewport.height/offsetTop, which iOS reports consistently;
 * deriving a keyboard height from window.innerHeight doesn't work on every iOS version (on iOS 26
 * innerHeight shrinks too, and the sheet ended up hidden behind the keyboard).
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
    if (open && !dialog.open) {
      dialog.showModal();
      // The field marked data-autofocus gets the focus (and keeps the keyboard that the tap opened).
      const target = dialog.querySelector<HTMLElement>('[data-autofocus]');
      if (target && document.activeElement !== target) target.focus({ preventScroll: true });
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    const vv = window.visualViewport;
    if (!open || !dialog || !vv) return;
    const fit = () => {
      const longSide = Math.max(window.screen?.height || 0, window.screen?.width || 0) || vv.height;
      // Ignore implausible readings (some iOS versions report 0 mid-animation): the CSS fallback
      // (full height) keeps the sheet usable.
      if (vv.height < 200 || vv.height > longSide + 1) {
        dialog.style.removeProperty('top');
        dialog.style.removeProperty('height');
        dialog.removeAttribute('data-keyboard');
        return;
      }
      dialog.style.top = `${Math.max(0, vv.offsetTop)}px`;
      dialog.style.height = `${vv.height}px`;
      // With the keyboard up the home indicator is hidden: no need for its bottom padding.
      dialog.toggleAttribute('data-keyboard', vv.height < longSide * 0.75 && window.matchMedia('(orientation: portrait)').matches);
    };
    fit();
    // The keyboard animates in; iOS doesn't always fire resize at the end of it.
    const timers = [80, 250, 500, 900].map((ms) => window.setTimeout(fit, ms));
    const refitSoon = () => timers.push(window.setTimeout(fit, 350));
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
    window.addEventListener('resize', fit);
    dialog.addEventListener('focusin', refitSoon);
    dialog.addEventListener('focusout', refitSoon);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      vv.removeEventListener('resize', fit);
      vv.removeEventListener('scroll', fit);
      window.removeEventListener('resize', fit);
      dialog.removeEventListener('focusin', refitSoon);
      dialog.removeEventListener('focusout', refitSoon);
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
        // A tap on the transparent area above the sheet closes it.
        if (e.target === ref.current) onClose();
      }}
      className="group fixed inset-x-0 top-0 m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 text-ink open:flex open:flex-col open:justify-end"
    >
      <div
        data-sheet-panel
        className="mx-auto flex max-h-[calc(100%-var(--safe-top)-12px)] min-h-0 w-full max-w-[480px] animate-sheet-up flex-col overflow-hidden rounded-t-[24px] bg-surface"
      >
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
        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-1',
            footer ? 'pb-4' : 'pb-[max(20px,var(--safe-bottom))] group-data-[keyboard]:pb-5',
          )}
        >
          {open && children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-line bg-surface px-5 pt-3 pb-[max(12px,var(--safe-bottom))] group-data-[keyboard]:pb-3">{footer}</div>
        )}
      </div>
    </dialog>
  );
}
