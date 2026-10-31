import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { type AsyncStorage } from '@tanstack/query-persist-client-core';
import { clear, createStore, del, get, set } from 'idb-keyval';

import { CACHE_PREFIX } from '@/pwa/shared';

/**
 * IndexedDB-backed storage for the TanStack Query persister. One database
 * (`gfm-query-cache`), one object store, one entry per viewer key.
 * `purgeOfflineState` deletes the whole DB on logout.
 */
const store = createStore(`${CACHE_PREFIX}query-cache`, 'keyval');

const idbStorage: AsyncStorage<string> = {
  getItem: (key) => get<string>(key, store).then((v) => v ?? null),
  setItem: (key, value) => set(key, value, store),
  removeItem: (key) => del(key, store),
};

/**
 * @param viewerKey  stable per signed-in identity, e.g. `user-<uuid>` / `anon`,
 *   so one viewer's cache is never restored into another's session.
 */
export function createQueryPersister(viewerKey: string) {
  return createAsyncStoragePersister({
    storage: idbStorage,
    key: `${CACHE_PREFIX}rq-${viewerKey}`,
    throttleTime: 1500,
    // Drop the biggest queries first if a write ever exceeds quota, then retry.
    retry: ({ persistedClient, errorCount }) => {
      if (errorCount > 3) return undefined;
      const queries = persistedClient.clientState.queries;
      if (!queries.length) return undefined;
      const sorted = [...queries].sort(
        (a, b) =>
          JSON.stringify(b.state.data ?? '').length - JSON.stringify(a.state.data ?? '').length
      );
      return {
        ...persistedClient,
        clientState: {
          ...persistedClient.clientState,
          queries: sorted.slice(1),
        },
      };
    },
  });
}

/** Wipe every persisted viewer cache (all keys in the store). */
export async function clearAllPersistedQueryCaches(): Promise<void> {
  try {
    await clear(store);
  } catch {
    // ignore
  }
}
