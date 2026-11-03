import 'fake-indexeddb/auto';

import { describe, expect, it, vi } from 'vitest';

import { outboxAdd, outboxCount } from '@/lib/pwa/outbox';

describe('purgeOfflineState', () => {
  it('clears caches, IndexedDB and the outbox without throwing', async () => {
    const deleted: string[] = [];
    vi.stubGlobal('caches', {
      keys: async () => ['gfm-api', 'gfm-static', 'workbox-precache-v2-x', 'other-app'],
      delete: async (key: string) => {
        deleted.push(key);
        return true;
      },
      match: async () => undefined,
    });
    vi.stubGlobal('navigator', { onLine: true });

    await outboxAdd({
      kind: 'inbox-reply',
      label: 'Reply',
      url: 'https://example.test/fn',
      method: 'POST',
      headers: {},
      body: '{}',
      idempotencyKey: 'k',
      invalidateKeys: [],
    });
    expect(await outboxCount()).toBe(1);

    const { purgeOfflineState } = await import('@/lib/pwa/purgeOfflineState');
    await expect(purgeOfflineState()).resolves.toBeUndefined();

    // Only app-owned caches are deleted, never another origin's leftovers.
    expect(deleted).toEqual(expect.arrayContaining(['gfm-api', 'gfm-static']));
    expect(deleted).not.toContain('other-app');
    expect(await outboxCount()).toBe(0);
  });

});
