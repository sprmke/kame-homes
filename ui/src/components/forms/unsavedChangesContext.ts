import { createContext, useContext } from 'react';

import type { UnsavedGuardRegistry } from '@/lib/unsavedChanges/registry';

export type UnsavedChangesContextValue = {
  registry: UnsavedGuardRegistry;
  /** Run a navigation that must not prompt (e.g. redirect right after a successful save). */
  runUnguarded: (fn: () => void) => void;
};

export const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

/** `null` outside the provider (tests, isolated renders), where guards silently no-op. */
export function useUnsavedChangesContext(): UnsavedChangesContextValue | null {
  return useContext(UnsavedChangesContext);
}
