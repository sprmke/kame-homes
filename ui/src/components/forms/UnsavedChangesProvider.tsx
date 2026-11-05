import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useBlocker, type BlockerFunction } from 'react-router-dom';

import { UnsavedChangesContext } from '@/components/forms/unsavedChangesContext';
import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { createUnsavedGuardRegistry, type GuardNavigation } from '@/lib/unsavedChanges/registry';
import { isReloadShortcut } from '@/lib/unsavedChanges/reloadShortcut';

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
  const bypassUnloadRef = useRef(false);
  const blockedNavRef = useRef<GuardNavigation | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [reloadOpen, setReloadOpen] = useState(false);

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
      if (bypassUnloadRef.current) return;
      if (!registry.hasBlocking()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [registry]);

  // Browsers refuse custom UI on `beforeunload`, so catch the refresh shortcuts
  // (F5, Cmd/Ctrl+R) first and show the app dialog. Toolbar reload / tab close
  // still falls back to the native prompt handled above.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (blocker.state === 'blocked') return;
      if (!isReloadShortcut(event) || !registry.hasBlocking()) return;
      event.preventDefault();
      event.stopPropagation();
      setReloadOpen(true);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [blocker.state, registry]);

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

  /** Reload after the dialog choice. Skip `beforeunload` so the browser does not ask twice. */
  const finishReload = () => {
    bypassUnloadRef.current = true;
    window.location.reload();
  };

  const handleReloadSave = async () => {
    setIsSaving(true);
    try {
      if (await registry.saveAll()) finishReload();
    } finally {
      setIsSaving(false);
    }
  };

  const handleReloadDiscard = () => {
    registry.discardAll();
    finishReload();
  };

  const showReloadConfirm = !isBlocked && reloadOpen;

  const value = useMemo(() => ({ registry, runUnguarded }), [registry, runUnguarded]);

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      <UnsavedChangesDialog
        open={(isBlocked && confirmOpen) || showReloadConfirm}
        isSaving={isSaving}
        onKeepEditing={() => {
          if (blocker.state === 'blocked') blocker.reset();
          else setReloadOpen(false);
        }}
        onDiscard={isBlocked ? handleDiscard : handleReloadDiscard}
        onSave={
          isBlocked
            ? registry.canSaveAll(blockedNavRef.current)
              ? () => void handleSave()
              : undefined
            : registry.canSaveAll()
              ? () => void handleReloadSave()
              : undefined
        }
      />
    </UnsavedChangesContext.Provider>
  );
}
