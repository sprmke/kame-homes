import { type QueryClient } from '@tanstack/react-query';

import { useOfflineSyncStore } from '@/features/dashboard/offline/store/offlineSyncStore';
import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';

import { outboxList, outboxRemove, outboxUpdate, type OutboxItem } from '@/lib/pwa/outbox';
import { pwaTelemetry } from '@/lib/pwa/pwaTelemetry';
import { getSwRegistration } from '@/lib/pwa/swRegistration';

import { OUTBOX_SYNC_TAG, SW_MESSAGE } from '@/pwa/shared';

const MAX_ATTEMPTS = 6;
/** 4xx that should still be retried rather than marked failed. */
const RETRYABLE_STATUS = new Set([408, 425, 429]);
const MAX_BACKOFF_MS = 60_000;

/** Parse `{ error }` from a failed edge response body (e.g. FEATURE_UNAVAILABLE copy). */
export function outboxErrorMessageFromResponseBody(body: string, fallback: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    // keep fallback
  }
  return fallback;
}

let draining = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let queryClientRef: QueryClient | null = null;

function pushStoreSnapshot(items: OutboxItem[]) {
  useOfflineSyncStore.getState().setItems(
    items.map((i) => ({
      id: i.id,
      kind: i.kind,
      label: i.label,
      createdAt: i.createdAt,
      attempts: i.attempts,
      lastError: i.lastError,
      status: i.status,
    }))
  );
}

/** Refresh the in-memory projection the UI reads. */
export async function refreshOutboxView(): Promise<void> {
  pushStoreSnapshot(await outboxList());
}

async function invalidate(keys: string[]) {
  if (!queryClientRef || keys.length === 0) return;
  await Promise.all(keys.map((root) => queryClientRef!.invalidateQueries({ queryKey: [root] })));
}

/**
 * Schedule a self-retry so a transient failure heals without waiting for the next
 * `online` / `visibilitychange` event (the operator may just be sitting on the
 * page). Exponential backoff off the highest pending attempt count.
 */
function scheduleRetry(pendingItems: OutboxItem[]) {
  if (retryTimer || pendingItems.length === 0) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  const maxAttempts = pendingItems.reduce((m, i) => Math.max(m, i.attempts), 0);
  const delay = Math.min(MAX_BACKOFF_MS, 2 ** Math.max(1, maxAttempts) * 1000);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void drainOutbox();
  }, delay);
}

/**
 * Drain the outbox FIFO. Stops on the first hard network failure (keeps items
 * for the next trigger). 2xx → done; retryable/5xx → keep + backoff; other 4xx →
 * mark failed for the Sync Center.
 */
export async function drainOutbox(): Promise<void> {
  if (draining) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  draining = true;
  useOfflineSyncStore.getState().setSyncing(true);

  let backedOff = false;
  try {
    let token: string | null = null;
    const items = (await outboxList()).filter((i) => i.status === 'pending');
    for (const item of items) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) break;
      if (!token) {
        try {
          token = await getSessionJwt();
        } catch {
          backedOff = true;
          break; // no session — try again after re-auth / next trigger
        }
      }

      let res: Response;
      try {
        res = await fetch(item.url, {
          method: item.method,
          headers: {
            ...item.headers,
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'Idempotency-Key': item.idempotencyKey,
          },
          body: item.body,
        });
      } catch (err) {
        // Network dropped mid-drain — leave everything pending, retry later.
        await outboxUpdate(item.id, {
          attempts: item.attempts + 1,
          lastError: err instanceof Error ? err.message : 'network error',
        });
        backedOff = true;
        break;
      }

      if (res.ok) {
        await outboxRemove(item.id);
        await invalidate(item.invalidateKeys);
        pwaTelemetry('sync-drained', { kind: item.kind });
        continue;
      }

      const attempts = item.attempts + 1;
      const body = await res.text().catch(() => '');
      const errorFromBody = (fallback: string) =>
        outboxErrorMessageFromResponseBody(body, fallback);
      if (RETRYABLE_STATUS.has(res.status) || res.status >= 500) {
        const lastError = errorFromBody(`HTTP ${res.status}`);
        if (attempts >= MAX_ATTEMPTS) {
          await outboxUpdate(item.id, {
            status: 'failed',
            attempts,
            lastError,
          });
          pwaTelemetry('sync-item-failed', { kind: item.kind, status: res.status });
        } else {
          await outboxUpdate(item.id, { attempts, lastError });
          backedOff = true;
          break; // backoff — scheduleRetry() below picks it up
        }
      } else {
        // 4xx (conflict, validation, auth) — not going to succeed on retry.
        const message = errorFromBody(`HTTP ${res.status}`);
        await outboxUpdate(item.id, { status: 'failed', attempts, lastError: message });
        pwaTelemetry('sync-item-failed', { kind: item.kind, status: res.status });
        await invalidate(item.invalidateKeys); // surface the server's real state
      }
    }
  } finally {
    draining = false;
    useOfflineSyncStore.getState().setSyncing(false);
    useOfflineSyncStore.getState().markSynced();
    const remaining = await outboxList();
    pushStoreSnapshot(remaining);
    if (backedOff) scheduleRetry(remaining.filter((i) => i.status === 'pending'));
  }
}

/** Manually retry a failed item (Sync Center "retry" button). */
export async function retryOutboxItem(id: string): Promise<void> {
  await outboxUpdate(id, { status: 'pending', attempts: 0, lastError: undefined });
  await refreshOutboxView();
  void drainOutbox();
}

export async function discardOutboxItem(id: string): Promise<void> {
  await outboxRemove(id);
  await refreshOutboxView();
}

async function registerBackgroundSync() {
  try {
    const reg = getSwRegistration();
    // `sync` is Chromium-only; harmless where unsupported.
    await (reg as unknown as { sync?: { register: (t: string) => Promise<void> } })?.sync?.register(
      OUTBOX_SYNC_TAG
    );
  } catch {
    // no-op
  }
}

let wired = false;

/** Call once from <PwaProvider> after the query client exists. */
export function initSyncEngine(queryClient: QueryClient): void {
  queryClientRef = queryClient;
  void refreshOutboxView();
  if (wired || typeof window === 'undefined') return;
  wired = true;

  const kick = () => {
    void drainOutbox();
    void registerBackgroundSync();
  };

  window.addEventListener('online', kick);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') kick();
  });
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
      if ((event.data as { type?: string })?.type === SW_MESSAGE.DRAIN_OUTBOX) void drainOutbox();
    });
  }

  if (typeof navigator === 'undefined' || navigator.onLine) kick();
}
