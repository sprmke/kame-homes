import { useCallback, useEffect, useRef } from 'react';

import { createStore, del, get, set } from 'idb-keyval';

import { CACHE_PREFIX } from '@/pwa/shared';

const store = createStore(`${CACHE_PREFIX}form-drafts`, 'keyval');

type DraftEnvelope<T> = { savedAt: number; values: T };

export type UseOfflineFormDraftOptions<T> = {
  /** Stable key for this form instance, e.g. `booking:${propertySlug}`. */
  key: string;
  /** Current form values to persist (already serialisable — strip File/Blob first). */
  values: T;
  /** Called once on mount if a fresh-enough draft exists. */
  onRestore: (values: T, savedAt: number) => void;
  /** Ignore drafts older than this (default 7 days). */
  maxAgeMs?: number;
  /** Pause saving (e.g. while a server prefill is loading). */
  enabled?: boolean;
  /** Debounce for writes (default 800ms). */
  debounceMs?: number;
};

/**
 * Autosaves a form's serialisable values to IndexedDB and restores them on mount
 * — so a half-filled form survives a reload or going offline. The caller owns
 * serialisation (drop `File`/`Blob` fields before passing `values`; those are
 * re-picked after restore) and must call `clear()` on successful submit.
 *
 * NOTE for the guest booking form: it has `File` fields and several async
 * `form.reset()` prefill paths — wire this only after confirming restore can't
 * race the `bookingId` prefill. See docs/architecture/pwa.md → Tier C.
 */
export function useOfflineFormDraft<T>({
  key,
  values,
  onRestore,
  maxAgeMs = 7 * 24 * 60 * 60 * 1000,
  enabled = true,
  debounceMs = 800,
}: UseOfflineFormDraftOptions<T>) {
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;
  const restoredRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    void del(key, store);
  }, [key]);

  // Restore once.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    void get<DraftEnvelope<T>>(key, store).then((env) => {
      if (!env) return;
      if (Date.now() - env.savedAt > maxAgeMs) {
        void del(key, store);
        return;
      }
      onRestoreRef.current(env.values, env.savedAt);
    });
  }, [key, maxAgeMs]);

  // Debounced save.
  useEffect(() => {
    if (!enabled) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void set(key, { savedAt: Date.now(), values } satisfies DraftEnvelope<T>, store);
    }, debounceMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [key, values, enabled, debounceMs]);

  return { clear };
}
