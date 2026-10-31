import { useCallback, useEffect, useRef, useState } from 'react';

import type { MarketingAutoSaveStatus } from '@/features/dashboard/marketing/hooks/useMarketingAutoSave';

type Options = {
  enabled?: boolean;
  suspended?: boolean;
  /** When false, changes still flip status to 'pending' but never reach the network — no debounce timer, no `save()` call. */
  persist?: boolean;
  debounceMs?: number;
  contentFingerprint: string | null;
  save: () => Promise<void>;
};

const SAVED_FLASH_MS = 2000;

/** Priority: error > saving > pending (Unsaved) > saved > idle. */
export function mergePageEditorAutoSaveStatuses(
  statuses: MarketingAutoSaveStatus[]
): MarketingAutoSaveStatus {
  if (statuses.includes('error')) return 'error';
  if (statuses.includes('saving')) return 'saving';
  if (statuses.includes('pending')) return 'pending';
  if (statuses.includes('saved')) return 'saved';
  return 'idle';
}

export function firstPageEditorAutoSaveError(
  entries: Array<{ status: MarketingAutoSaveStatus; errorMessage: string | null }>
): string | null {
  for (const entry of entries) {
    if (entry.status === 'error' && entry.errorMessage) return entry.errorMessage;
  }
  return null;
}

/** Debounced fingerprint autosave — mirrors useMarketingAutoSave without template IDs. */
export function usePageEditorAutoSave({
  enabled = true,
  suspended = false,
  persist = true,
  debounceMs = 1000,
  contentFingerprint,
  save,
}: Options) {
  const [status, setStatus] = useState<MarketingAutoSaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const lastSavedFingerprintRef = useRef<string | null>(null);
  const saveGenerationRef = useRef(0);
  const wasSuspendedRef = useRef(false);
  const pendingBaselineRef = useRef(false);
  const savedFlashTimerRef = useRef<number | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (suspended) {
      wasSuspendedRef.current = true;
      return;
    }
    if (wasSuspendedRef.current) {
      wasSuspendedRef.current = false;
      pendingBaselineRef.current = true;
    }
    if (!pendingBaselineRef.current || !contentFingerprint) return;
    // Only adopt a hydrate baseline. If the fingerprint already diverged from an
    // earlier baseline (user edited while suspended), keep lastSaved so the save
    // effect can persist those edits.
    if (
      lastSavedFingerprintRef.current !== null &&
      contentFingerprint !== lastSavedFingerprintRef.current
    ) {
      pendingBaselineRef.current = false;
      return;
    }
    pendingBaselineRef.current = false;
    lastSavedFingerprintRef.current = contentFingerprint;
    setStatus('idle');
    setErrorMessage(null);
  }, [suspended, contentFingerprint]);

  useEffect(() => {
    if (!enabled || suspended || !contentFingerprint) return;
    if (contentFingerprint === lastSavedFingerprintRef.current) return;

    setStatus((current) => (current === 'pending' ? current : 'pending'));
    setErrorMessage(null);

    if (!persist) return;

    const generation = ++saveGenerationRef.current;
    const fingerprintAtSchedule = contentFingerprint;
    const timer = window.setTimeout(() => {
      void (async () => {
        if (generation !== saveGenerationRef.current) return;
        setStatus('saving');
        try {
          await saveRef.current();
          if (generation !== saveGenerationRef.current) return;
          lastSavedFingerprintRef.current = fingerprintAtSchedule;
          setStatus('saved');
          setErrorMessage(null);
          if (savedFlashTimerRef.current) window.clearTimeout(savedFlashTimerRef.current);
          savedFlashTimerRef.current = window.setTimeout(() => {
            setStatus((current) => (current === 'saved' ? 'idle' : current));
          }, SAVED_FLASH_MS);
        } catch (error) {
          if (generation !== saveGenerationRef.current) return;
          setStatus('error');
          setErrorMessage(error instanceof Error ? error.message : 'Save failed');
        }
      })();
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [contentFingerprint, debounceMs, enabled, suspended, persist]);

  useEffect(() => {
    return () => {
      if (savedFlashTimerRef.current) window.clearTimeout(savedFlashTimerRef.current);
    };
  }, []);

  const markSaved = useCallback((fingerprint: string) => {
    lastSavedFingerprintRef.current = fingerprint;
    setStatus('idle');
    setErrorMessage(null);
  }, []);

  /** Saves immediately, bypassing the debounce — for a manual Save click or a leave-confirm
   * "Save" choice. Cancels any in-flight debounced save so the two never race each other.
   * Respects the same `enabled`/`suspended`/`persist` gates as the normal debounced path. */
  const saveNow = useCallback(async () => {
    if (!enabled || suspended || !persist) return;
    if (!contentFingerprint || contentFingerprint === lastSavedFingerprintRef.current) return;
    const generation = ++saveGenerationRef.current;
    setStatus('saving');
    setErrorMessage(null);
    try {
      await saveRef.current();
      if (generation !== saveGenerationRef.current) return;
      lastSavedFingerprintRef.current = contentFingerprint;
      setStatus('saved');
      if (savedFlashTimerRef.current) window.clearTimeout(savedFlashTimerRef.current);
      savedFlashTimerRef.current = window.setTimeout(() => {
        setStatus((current) => (current === 'saved' ? 'idle' : current));
      }, SAVED_FLASH_MS);
    } catch (error) {
      if (generation !== saveGenerationRef.current) return;
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Save failed');
      throw error;
    }
  }, [enabled, suspended, persist, contentFingerprint]);

  return { status, errorMessage, markSaved, saveNow };
}
