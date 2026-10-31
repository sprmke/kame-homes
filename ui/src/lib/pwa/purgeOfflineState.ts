import { useOfflineSyncStore } from '@/features/dashboard/offline/store/offlineSyncStore';

import { outboxClear } from '@/lib/pwa/outbox';
import { clearAllPersistedQueryCaches } from '@/lib/pwa/queryPersister';

import { CACHE_PREFIX, OUTBOX_DB_NAME } from '@/pwa/shared';

/** IndexedDB databases the PWA owns — best-effort delete after the store-level clear. */
const OWNED_IDB = [OUTBOX_DB_NAME, `${CACHE_PREFIX}query-cache`];

async function deleteAppCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((k) => k.startsWith(CACHE_PREFIX) || k.startsWith('workbox-'))
      .map((k) => caches.delete(k))
  );
}

/**
 * Empty the owned IndexedDB stores. `deleteDatabase` is BLOCKED while `idb` /
 * `idb-keyval` hold an open connection (which they do for the app's lifetime), so
 * a store-level `clear()` is what actually removes the bytes on sign-out without a
 * reload. `deleteDatabase` is still attempted as belt-and-suspenders for the next
 * reload.
 */
async function clearOwnedIdb(): Promise<void> {
  await Promise.allSettled([clearAllPersistedQueryCaches(), outboxClear()]);
  if (typeof indexedDB === 'undefined') return;
  await Promise.allSettled(
    OWNED_IDB.map(
      (name) =>
        new Promise<void>((resolve) => {
          try {
            const req = indexedDB.deleteDatabase(name);
            req.onsuccess = req.onerror = req.onblocked = () => resolve();
          } catch {
            resolve();
          }
        })
    )
  );
}

async function unsubscribeLocalPush(): Promise<void> {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    // Local-only: the orphaned server row auto-prunes on the next 404/410 from
    // push-fanout (reconcilePushFailures). A server call here would need a token
    // that may already be gone.
    await sub?.unsubscribe();
  } catch {
    // ignore
  }
}

/**
 * Wipes every trace of offline state for the current viewer. Call on sign-out and
 * when the SW kill-switch fires. Never throws — a partial purge is better than a
 * blocked logout.
 */
export async function purgeOfflineState(): Promise<void> {
  try {
    useOfflineSyncStore.getState().reset();
  } catch {
    // ignore
  }
  await Promise.allSettled([deleteAppCaches(), clearOwnedIdb(), unsubscribeLocalPush()]);
  try {
    if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
      await navigator.clearAppBadge?.();
    }
  } catch {
    // ignore
  }
}
