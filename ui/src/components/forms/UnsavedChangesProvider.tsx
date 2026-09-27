import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useBlocker, type BlockerFunction } from 'react-router-dom';

import { UnsavedChangesContext } from '@/components/forms/unsavedChangesContext';
import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { createUnsavedGuardRegistry, type GuardNavigation } from '@/lib/unsavedChanges/registry';

const toGuardNavigation: (args: Parameters<BlockerFunction>[0]) => GuardNavigation = ({
  currentLocation,
  nextLocation,
}) => ({
  currentPathname: currentLocation.pathname,
  currentSearch: currentLocation.search,
  nextPathname: nextLocation.pathname,
  nextSearch: nextLocation.search,
});

/**
 * Mount once, inside the data router. Owns the router blocker, the
 * `beforeunload` prompt (tab close / refresh) and the confirmation dialog for
 * every form that calls `useUnsavedChangesGuard`. Requires `createBrowserRouter`
 * (see `main.tsx`); `useBlocker` does not work under `<BrowserRouter>`.
 */
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const registry = useMemo(createUnsavedGuardRegistry, []);
  const bypassRef = useRef(false);
  const blockedNavRef = useRef<GuardNavigation | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  const blocker = useBlocker(
    useCallback<BlockerFunction>(
      (args) => {
        if (bypassRef.current) return false;
        const nav = toGuardNavigation(args);
        if (!registry.hasBlocking(nav)) return false;
        blockedNavRef.current = nav;
        return true;
      },
      [registry]
    )
  );

  const runUnguarded = useCallback((fn: () => void) => {
    bypassRef.current = true;
    try {
      fn();
    } finally {
      bypassRef.current = false;
    }
  }, []);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!registry.hasBlocking()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [registry]);

  const isBlocked = blocker.state === 'blocked';
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Re-check after commit: a form that saved and navigated in the same tick still
  // held a stale dirty flag when the blocker ran, so let it settle before asking.
  useEffect(() => {
    if (blocker.state !== 'blocked') {
      setConfirmOpen(false);
      return;
    }
    if (registry.hasBlocking(blockedNavRef.current)) setConfirmOpen(true);
    else blocker.proceed();
  }, [blocker, registry]);

  const handleSave = async () => {
    if (blocker.state !== 'blocked') return;
    setIsSaving(true);
    try {
      const saved = await registry.saveAll(blockedNavRef.current);
      if (saved) blocker.proceed();
      else blocker.reset();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    if (blocker.state !== 'blocked') return;
    registry.discardAll(blockedNavRef.current);
    blocker.proceed();
  };

  const value = useMemo(() => ({ registry, runUnguarded }), [registry, runUnguarded]);

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      <UnsavedChangesDialog
        open={isBlocked && confirmOpen}
        isSaving={isSaving}
        onKeepEditing={() => blocker.state === 'blocked' && blocker.reset()}
        onDiscard={handleDiscard}
        onSave={
          isBlocked && registry.canSaveAll(blockedNavRef.current)
            ? () => void handleSave()
            : undefined
        }
      />
    </UnsavedChangesContext.Provider>
  );
}
