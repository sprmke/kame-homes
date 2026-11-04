import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryPersister } from '@/lib/pwa/queryPersister';

describe('query persister', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('namespaces the persisted cache per viewer identity', async () => {
    const viewerA = createQueryPersister('user-a');
    const viewerB = createQueryPersister('user-b');
    const client = {
      timestamp: Date.now(),
      buster: '1',
      clientState: { mutations: [], queries: [] },
    };
    await viewerA.persistClient(client as never);

    expect(await viewerA.restoreClient()).not.toBeNull();
    // A different identity must not see the previous viewer's cache.
    expect(await viewerB.restoreClient()).toBeUndefined();
  });

  it('forgets the cache once it is cleared (logout)', async () => {
    const { clearAllPersistedQueryCaches } = await import('@/lib/pwa/queryPersister');
    const persister = createQueryPersister('user-a');
    await persister.persistClient({
      timestamp: Date.now(),
      buster: '1',
      clientState: { mutations: [], queries: [] },
    } as never);
    await clearAllPersistedQueryCaches();
    expect(await persister.restoreClient()).toBeUndefined();
  });
});
