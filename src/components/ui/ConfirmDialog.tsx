import { useState, type ReactNode } from 'react';
import { T } from '../../texts';
import { Button } from './Button';
import { Sheet } from './Sheet';

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = T.common.delete,
  danger = true,
  onConfirm,
  onClose,
  children,
  confirmDisabled,
}: {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  children?: ReactNode;
  confirmDisabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      testId="confirm-dialog"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" block onClick={onClose}>
            {T.common.cancel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            block
            disabled={busy || confirmDisabled}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {body && <div className="text-[15px] leading-relaxed text-ink-2">{body}</div>}
      {children}
    </Sheet>
  );
}
