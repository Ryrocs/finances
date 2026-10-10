import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { T } from '../../texts';
import { cn } from './cn';

/** Inputs that bring up the on-screen keyboard (date/time fields open a picker instead). */
const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'color', 'date', 'datetime-local', 'file', 'hidden', 'image', 'month', 'radio', 'range', 'reset', 'submit', 'time', 'week']);

function opensKeyboard(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly;
  if (el instanceof HTMLInputElement) return !el.readOnly && !NON_TEXT_INPUTS.has(el.type);
  return el instanceof HTMLElement && el.isContentEditable;
}

/**
 * Height of the on-screen keyboard, or 0.
 *
 * iOS doesn't resize the layout viewport for the keyboard: fixed elements stay anchored to the
 * bottom of the screen, behind it. The keyboard is the part of the layout viewport the visual
 * viewport no longer covers. On iOS 26 window.innerHeight shrinks along with the visual viewport
 * (so innerHeight − visualViewport.height reads 0), while documentElement.clientHeight keeps the
 * full height: take the larger of the two. Only measured while a text field is focused, because
 * installed web apps can report a small constant difference even without a keyboard.
 */
export function keyboardInset(): number {
  const vv = window.visualViewport;
  if (!vv || !opensKeyboard(document.activeElement)) return 0;
  const layout = Math.max(window.innerHeight, document.documentElement.clientHeight);
  const inset = layout - vv.height - Math.max(0, vv.offsetTop);
  // Ignore readings that can't be a keyboard (e.g. 0 mid-animation, or bogus values).
  return inset > 80 && inset < layout * 0.75 ? Math.round(inset) : 0;
}

/**
 * Bottom sheet built on the native <dialog> (top layer: always above the tab bar and the floating
 * button; focus trap and Escape for free). The footer — where "Guardar" lives — is outside the
 * scrolling area and padded for the iPhone home indicator.
 *
 * The dialog spans from the top of the screen down to the keyboard (`--kb`). Forms use
 * `fill`: the sheet is anchored to the top and fills that space, so even if a browser reports the
 * keyboard wrongly, its title and first fields are always visible above it, and when the
 * measurement is right "Guardar" sits just above the keyboard.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  header,
  testId,
  fill = false,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Extra content pinned under the title (e.g. the type selector). */
  header?: ReactNode;
  testId?: string;
  /** Full-height sheet anchored to the top (forms with text fields). */
  fill?: boolean;
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
    if (!open || !dialog) return;
    let frame = 0;
    const measure = () => {
      const kb = keyboardInset();
      dialog.style.setProperty('--kb', `${kb}px`);
      dialog.toggleAttribute('data-keyboard', kb > 0);
    };
    // Read two frames later, once the viewport values have settled.
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(measure);
      });
    };
    measure();
    // The keyboard animates in and iOS doesn't always fire resize at the end of it.
    const timers = [100, 300, 600, 1000].map((ms) => window.setTimeout(schedule, ms));
    const vv = window.visualViewport;
    vv?.addEventListener('resize', schedule);
    vv?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach((t) => window.clearTimeout(t));
      vv?.removeEventListener('resize', schedule);
      vv?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
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
        // A tap on the transparent area around the sheet closes it.
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        'group fixed inset-x-0 top-0 bottom-[var(--kb,0px)] m-0 h-auto max-h-none w-full max-w-none bg-transparent p-0 text-ink',
        'open:flex open:flex-col',
        fill ? 'open:justify-start' : 'open:justify-end',
      )}
    >
      <div
        data-sheet-panel
        className={cn(
          'mx-auto flex min-h-0 w-full max-w-[480px] animate-sheet-up flex-col overflow-hidden rounded-t-[24px] bg-surface',
          fill ? 'mt-[calc(var(--safe-top)+12px)] flex-1' : 'max-h-[calc(100%-var(--safe-top)-12px)]',
        )}
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
