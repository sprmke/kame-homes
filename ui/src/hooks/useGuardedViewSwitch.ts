import { useCallback, useState } from 'react';

import { useUnsavedChangesContext } from '@/components/forms/unsavedChangesContext';
import type { UnsavedChangesDialogProps } from '@/components/forms/UnsavedChangesDialog';

type Options<T> = {
  /** Apply the switch once nothing is at risk. */
  onCommit: (next: T) => void;
};

/**
 * Unsaved-changes guard for a tab or view switch that stays on the same route
 * but unmounts the forms in the outgoing view (e.g. the Notifications hub
 * Activity / Telegram tabs). Route changes and tab close are already covered by
 * each form's own `useUnsavedChangesGuard`; this covers the in-page switch,
 * which those guards ignore by design (`blocksOn: 'pathname'`).
 *
 * ```tsx
 * const { requestSwitch, dialogProps } = useGuardedViewSwitch({ onCommit: setView });
 * <Tabs onValueChange={requestSwitch} />
 * <UnsavedChangesDialog {...dialogProps} />
 * ```
 *
 * Every switch path must go through `requestSwitch`; calling `onCommit`
 * directly skips the prompt.
 */
export function useGuardedViewSwitch<T>({ onCommit }: Options<T>) {
  const context = useUnsavedChangesContext();
  const registry = context?.registry;
  const [pending, setPending] = useState<{ next: T } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const requestSwitch = useCallback(
    (next: T) => {
      // No `nav` argument: the outgoing view unmounts, so every dirty form is at
      // risk regardless of its `blocksOn`.
      if (registry?.hasBlocking()) {
        setPending({ next });
        return;
      }
      onCommit(next);
    },
    [onCommit, registry]
  );

  const commit = useCallback(
    (next: T) => {
      setPending(null);
      onCommit(next);
    },
    [onCommit]
  );

  const canSave = Boolean(pending && registry?.canSaveAll());

  const dialogProps: UnsavedChangesDialogProps = {
    open: pending !== null,
    action: 'leave',
    isSaving,
    onKeepEditing: () => setPending(null),
    onDiscard: () => {
      if (!pending) return;
      registry?.discardAll();
      commit(pending.next);
    },
    onSave:
      canSave && registry
        ? async () => {
            if (!pending) return;
            setIsSaving(true);
            try {
              if (await registry.saveAll()) commit(pending.next);
              else setPending(null);
            } catch {
              setPending(null);
            } finally {
              setIsSaving(false);
            }
          }
        : undefined,
  };

  return { requestSwitch, dialogProps };
}
