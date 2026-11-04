import 'fake-indexeddb/auto';

import { describe, expect, it, vi } from 'vitest';

/**
 * Shared-device sign-out (PWA v2 task 8.3): a second host signing in on the same
 * installed app must not inherit the first host's device push subscription or a
 * stale app-icon count. Kept in its own file so the fake IndexedDB connections
 * from the outbox test cannot block this purge's `deleteDatabase`.
 */
describe('purgeOfflineState — device handles', () => {
  it('unsubscribes push and clears the badge on sign-out', async () => {
    vi.stubGlobal('caches', {
      keys: async () => [],
      delete: async () => true,
      match: async () => undefined,
    });
    const unsubscribe = vi.fn(async () => true);
    const clearAppBadge = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', {
      onLine: true,
      setAppBadge: vi.fn(),
      clearAppBadge,
      serviceWorker: {
        getRegistration: async () => ({
          pushManager: { getSubscription: async () => ({ unsubscribe }) },
        }),
      },
    });

    const { purgeOfflineState } = await import('@/lib/pwa/purgeOfflineState');
    await purgeOfflineState();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(clearAppBadge).toHaveBeenCalledTimes(1);
  });
});
