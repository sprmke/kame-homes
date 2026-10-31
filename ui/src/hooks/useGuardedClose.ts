import { useCallback, useRef, useState } from 'react';

import type { UnsavedChangesDialogProps } from '@/components/forms/UnsavedChangesDialog';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import type { GuardSaveResult } from '@/lib/unsavedChanges/registry';

type Options = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDirty: boolean;
  /** Persist the draft for "Save & close". Resolve `false` (or throw) to keep the modal open. */
  onSave?: () => Promise<GuardSaveResult> | GuardSaveResult;
  /** Reset the draft when the user discards. */
  onDiscard?: () => void;
  enabled?: boolean;
};

/**
 * Unsaved-changes guard for a form inside a modal, sheet or inline editor that
 * closes without a route change. Route changes and tab close while it is open
 * are covered too (it registers with the global guard).
 *
 * ```tsx
 * const { onOpenChange, requestClose, dialogProps } = useGuardedClose({ open, onOpenChange: setOpen, isDirty, onSave });
 * <AdminDialogShell open={open} onOpenChange={onOpenChange} footer={<Button onClick={requestClose}>Cancel</Button>} />
 * <UnsavedChangesDialog {...dialogProps} />
 * ```
 *
 * Wire every close path (Cancel button, X, Esc, backdrop) through `requestClose`
 * / the returned `onOpenChange`; a direct `setOpen(false)` skips the prompt.
 */
export function useGuardedClose({
  open,
  onOpenChange,
  isDirty,
  onSave,
  onDiscard,
  enabled = true,
}: Options) {
  const [confirming, setConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const active = enabled && isDirty;
  // Radix can fire a stray outside-dismiss right after the confirm unmounts; ignore it.
  const ignoreCloseUntilRef = useRef(0);

  useUnsavedChangesGuard({ isDirty: active && open, onSave, onDiscard });

  const close = useCallback(() => {
    setConfirming(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const requestClose = useCallback(() => {
    if (Date.now() < ignoreCloseUntilRef.current) return;
    if (active) setConfirming(true);
    else onOpenChange(false);
  }, [active, onOpenChange]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) onOpenChange(true);
      else requestClose();
    },
    [onOpenChange, requestClose]
  );

  const dialogProps: UnsavedChangesDialogProps = {
    open: confirming && open,
    action: 'close',
    isSaving,
    onKeepEditing: () => {
      ignoreCloseUntilRef.current = Date.now() + 400;
      setConfirming(false);
    },
    onDiscard: () => {
      onDiscard?.();
      close();
    },
    onSave: onSave
      ? async () => {
          setIsSaving(true);
          try {
            const result = await onSave();
            if (result === false) setConfirming(false);
            else close();
          } catch {
            setConfirming(false);
          } finally {
            setIsSaving(false);
          }
        }
      : undefined,
  };

  return { onOpenChange: handleOpenChange, requestClose, dialogProps };
}
