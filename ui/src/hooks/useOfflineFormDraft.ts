import { useCallback, useEffect, useRef } from 'react';

import { clear, createStore, del, get, set } from 'idb-keyval';

import { DRAFTS_DB_NAME } from '@/pwa/shared';

/**
 * Guest form drafts: a half-filled form survives a reload, a crash or losing the
 * connection. Text values and file `Blob`s live in the same IndexedDB database but
 * under separate keys, because `structuredClone` handles Blobs (iOS 14+) only when
 * they are not mixed into a JSON-ish envelope.
 *
 * Privacy: drafts hold guest PII. They are device-local, never synced, expire after
 * 7 days, are removed on successful submit, and are wiped by `purgeOfflineState`
 * (logout, kill-switch, "Clear offline data").
 */
const store = createStore(DRAFTS_DB_NAME, 'drafts');

const VALUES_PREFIX = 'values:';
const FILES_PREFIX = 'files:';

type DraftEnvelope<T> = { savedAt: number; values: T };

export const DEFAULT_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type DraftFile = { name: string; type: string; blob: Blob };

export type UseOfflineFormDraftOptions<T> = {
  /** Stable key for this form instance, e.g. `booking:<propertySlug>`. */
  key: string;
  /** Current serialisable form values. */
  values: T;
  /** Current file selections (already picked, not yet uploaded). */
  files?: Record<string, DraftFile | null>;
  /** Called once on mount when a fresh-enough draft exists. */
  onRestore: (values: T, savedAt: number) => void;
  /** Called once on mount when a fresh-enough file draft exists. */
  onRestoreFiles?: (files: Record<string, DraftFile | null>, savedAt: number) => void;
  maxAgeMs?: number;
  /** Pause saving (e.g. while a server prefill is loading). */
  enabled?: boolean;
  debounceMs?: number;
};

export function useOfflineFormDraft<T>({
  key,
  values,
  files,
  onRestore,
  onRestoreFiles,
  maxAgeMs = DEFAULT_DRAFT_MAX_AGE_MS,
  enabled = true,
  debounceMs = 800,
}: UseOfflineFormDraftOptions<T>) {
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;
  const onRestoreFilesRef = useRef(onRestoreFiles);
  onRestoreFilesRef.current = onRestoreFiles;
  const restoredRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDraft = useCallback(() => {
    void del(`${VALUES_PREFIX}${key}`, store);
    void del(`${FILES_PREFIX}${key}`, store);
  }, [key]);

  // Restore once, before the first save.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    void (async () => {
      const envelope = await get<DraftEnvelope<T>>(`${VALUES_PREFIX}${key}`, store);
      if (envelope) {
        if (Date.now() - envelope.savedAt > maxAgeMs) {
          void del(`${VALUES_PREFIX}${key}`, store);
        } else {
          onRestoreRef.current(envelope.values, envelope.savedAt);
        }
      }
      const fileEnvelope = await get<DraftEnvelope<Record<string, DraftFile | null>>>(
        `${FILES_PREFIX}${key}`,
        store
      );
      if (fileEnvelope) {
        if (Date.now() - fileEnvelope.savedAt > maxAgeMs) {
          void del(`${FILES_PREFIX}${key}`, store);
        } else {
          onRestoreFilesRef.current?.(fileEnvelope.values, fileEnvelope.savedAt);
        }
      }
    })();
  }, [key, maxAgeMs]);

  // Debounced save.
  useEffect(() => {
    if (!enabled) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const savedAt = Date.now();
      void set(`${VALUES_PREFIX}${key}`, { savedAt, values } satisfies DraftEnvelope<T>, store);
      if (files) {
        void set(`${FILES_PREFIX}${key}`, { savedAt, values: files } satisfies DraftEnvelope<
          Record<string, DraftFile | null>
        >, store);
      }
    }, debounceMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [key, values, files, enabled, debounceMs]);

  return { clear: clearDraft };
}

function stripValue(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  // File / Blob / functions / DOM nodes are never persisted: they are large, may be
  // un-cloneable, and must be re-picked after a restore.
  if (type !== 'object') return undefined;
  if (typeof File !== 'undefined' && value instanceof File) return undefined;
  if (typeof Blob !== 'undefined' && value instanceof Blob) return undefined;
  if (Array.isArray(value)) {
    return value.map(stripValue).filter((item) => item !== undefined);
  }
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const stripped = stripValue(nested);
    if (stripped !== undefined) out[key] = stripped;
  }
  return out;
}

/**
 * Draft-safe copy of form values: primitives, arrays and plain objects survive;
 * `File`, `Blob`, functions and dates-as-objects do not.
 */
export function toDraftValues<T extends Record<string, unknown>>(values: T): Partial<T> {
  return stripValue(values) as Partial<T>;
}

/** Imperative API for forms that already own their own change subscription. */
export async function saveFormDraft<T>(key: string, values: T): Promise<void> {
  try {
    await set(`${VALUES_PREFIX}${key}`, { savedAt: Date.now(), values } satisfies DraftEnvelope<T>, store);
  } catch {
    // quota / private mode — a draft is an optimisation, never a requirement
  }
}

export async function readFormDraft<T>(
  key: string,
  maxAgeMs = DEFAULT_DRAFT_MAX_AGE_MS
): Promise<{ values: T; savedAt: number } | null> {
  try {
    const envelope = await get<DraftEnvelope<T>>(`${VALUES_PREFIX}${key}`, store);
    if (!envelope) return null;
    if (Date.now() - envelope.savedAt > maxAgeMs) {
      await del(`${VALUES_PREFIX}${key}`, store);
      return null;
    }
    return envelope;
  } catch {
    return null;
  }
}

export async function clearFormDraft(key: string): Promise<void> {
  try {
    await del(`${VALUES_PREFIX}${key}`, store);
    await del(`${FILES_PREFIX}${key}`, store);
  } catch {
    // ignore
  }
}

/** Every draft on this device — used by `purgeOfflineState`. */
export async function clearAllFormDrafts(): Promise<void> {
  try {
    await clear(store);
  } catch {
    // never block a logout on a storage failure
  }
}
