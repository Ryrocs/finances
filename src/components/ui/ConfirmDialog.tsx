'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useI18n } from '@/components/providers/I18nProvider';
import { Button } from './Button';

/** Small centred confirmation (role="alertdialog"). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  loading,
  destructive = true,
  children,
}: {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  destructive?: boolean;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const { t } = useI18n();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-surface p-0 text-ink shadow-sheet open:animate-fade-in"
    >
      <div className="p-5">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        {description && (
          <p id={descId} className="mt-2 text-[15px] leading-relaxed text-ink-2">
            {description}
          </p>
        )}
        {children}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="soft" onClick={onCancel} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel ?? t('common.delete')}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
