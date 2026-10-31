import { useEffect, useId, useRef } from 'react';

import { useUnsavedChangesContext } from '@/components/forms/unsavedChangesContext';
import type { GuardSaveResult } from '@/lib/unsavedChanges/registry';

export type UnsavedChangesGuardOptions = {
  /** True while the form holds edits that are not persisted. */
  isDirty: boolean;
  /**
   * Persist the draft for "Save & leave". Resolve `false` (or throw) when it
   * failed or validation blocked it, so the user stays on the page. Omit only
   * when there is no way to save from here; the prompt then offers Discard only.
   */
  onSave?: () => Promise<GuardSaveResult> | GuardSaveResult;
  /** Reset local state on Discard. Only needed if the form stays mounted after leaving. */
  onDiscard?: () => void;
  /** `pathname` (default) ignores in-page `?tab=` changes; `location` blocks any URL change. */
  blocksOn?: 'pathname' | 'location';
  /** Turn the guard off (read-only, autosave active, no permission to edit). Default true. */
  enabled?: boolean;
};

/**
 * Warns before route changes, back/forward and tab close while `isDirty`, with
 * Save & leave / Discard / Keep editing. Call once per independently saveable
 * form or section; several can be mounted at once and are saved together.
 *
 * Dirty state is read lazily from refs, so this never adds renders.
 */
export function useUnsavedChangesGuard(options: UnsavedChangesGuardOptions): void {
  const context = useUnsavedChangesContext();
  const id = useId();
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const registry = context?.registry;

  useEffect(() => {
    if (!registry) return;
    return registry.register({
      id,
      isDirty: () => optionsRef.current.enabled !== false && optionsRef.current.isDirty,
      get save() {
        const { onSave } = optionsRef.current;
        return onSave ? () => onSave() : undefined;
      },
      discard: () => optionsRef.current.onDiscard?.(),
      get blocksOn() {
        return optionsRef.current.blocksOn;
      },
    });
  }, [registry, id]);
}

/**
 * Wrap a programmatic `navigate()` that fires right after a successful save
 * (e.g. slug rename redirect). The form's dirty flag is still stale that tick,
 * so without this the guard would prompt on a save that just succeeded.
 */
export function useRunUnguarded(): (fn: () => void) => void {
  const context = useUnsavedChangesContext();
  return context?.runUnguarded ?? ((fn) => fn());
}
