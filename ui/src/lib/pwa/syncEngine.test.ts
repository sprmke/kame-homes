import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { outboxAdd, outboxClear, outboxList } from '@/lib/pwa/outbox';

// `syncEngine` pulls the session + telemetry graph; stub the JWT so the drain can
// run in Node without Supabase.
let jwt: string | null = 'test-jwt';
vi.mock('@/features/dashboard/org/lib/edgeClient', () => ({
  getSessionJwt: async () => {
    if (!jwt) throw new Error('Not signed in');
    return jwt;
  },
}));

const { drainOutbox, retryOutboxItem } = await import('@/lib/pwa/syncEngine');

function queue(overrides: Partial<Parameters<typeof outboxAdd>[0]> = {}) {
  return outboxAdd({
    kind: 'inbox-reply',
    label: 'Reply to guest',
    url: 'https://example.supabase.co/functions/v1/social-inbox-send',
    method: 'POST',
    headers: {},
    body: '{"text":"hi"}',
    idempotencyKey: `key-${Math.random().toString(36).slice(2)}`,
    invalidateKeys: [],
    ...overrides,
  });
}

function respondWith(status: number, body: unknown = { success: true }) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

beforeEach(async () => {
  await outboxClear();
  jwt = 'test-jwt';
  vi.unstubAllGlobals();
  // Node has a `navigator` global without `onLine`; the drainer treats that as
  // offline and returns early, so every test needs an explicit online stub.
  vi.stubGlobal('navigator', { onLine: true });
});

describe('drainOutbox', () => {
  it('does not enter a syncing state when nothing is queued', async () => {
    const fetchMock = respondWith(200);
    vi.stubGlobal('fetch', fetchMock);
    const { useOfflineSyncStore } =
      await import('@/features/dashboard/offline/store/offlineSyncStore');
    useOfflineSyncStore.getState().reset();
    const seen: boolean[] = [];
    const unsubscribe = useOfflineSyncStore.subscribe((state) => {
      seen.push(state.syncing);
    });

    await drainOutbox();
    unsubscribe();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(seen).not.toContain(true);
    expect(useOfflineSyncStore.getState().syncing).toBe(false);
  });

  it('sends queued items with the idempotency key and clears them', async () => {
    const fetchMock = respondWith(200);
    vi.stubGlobal('fetch', fetchMock);
    await queue({ idempotencyKey: 'stable-key' });

    await drainOutbox();

    expect(await outboxList()).toEqual([]);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe('stable-key');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer test-jwt');
  });

  it('keeps items and backs off on a 5xx', async () => {
    vi.stubGlobal('fetch', respondWith(503, { success: false, error: 'boom' }));
    await queue();

    await drainOutbox();

    const [entry] = await outboxList();
    expect(entry?.status).toBe('pending');
    expect(entry?.attempts).toBe(1);
    expect(entry?.lastError).toBe('boom');
  });

  it('marks a non-retryable 4xx as failed and keeps the server message', async () => {
    vi.stubGlobal('fetch', respondWith(409, { success: false, error: 'State already moved' }));
    await queue();

    await drainOutbox();

    const [entry] = await outboxList();
    expect(entry).toMatchObject({ status: 'failed', lastError: 'State already moved' });
  });

  it('treats 408/425/429 as retryable', async () => {
    vi.stubGlobal('fetch', respondWith(429, { success: false, error: 'slow down' }));
    await queue();

    await drainOutbox();

    const [entry] = await outboxList();
    expect(entry?.status).toBe('pending');
  });

  it('keeps everything pending when the network drops mid-drain', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      })
    );
    await queue();

    await drainOutbox();

    const [entry] = await outboxList();
    expect(entry?.status).toBe('pending');
    expect(entry?.attempts).toBe(1);
  });

  it('never drops queued items when the session is gone', async () => {
    jwt = null;
    const fetchMock = respondWith(200);
    vi.stubGlobal('fetch', fetchMock);
    await queue();

    await drainOutbox();

    expect(fetchMock).not.toHaveBeenCalled();
    expect((await outboxList())[0]?.status).toBe('pending');
  });

  it('retires an item after the attempt cap', async () => {
    vi.stubGlobal('fetch', respondWith(503, { success: false, error: 'still down' }));
    const created = await queue();
    const { outboxUpdate } = await import('@/lib/pwa/outbox');
    await outboxUpdate(created.id, { attempts: 5 });

    await drainOutbox();

    const [entry] = await outboxList();
    expect(entry).toMatchObject({ status: 'failed', attempts: 6 });
  });
});

describe('retryOutboxItem', () => {
  it('puts a failed item back in the queue', async () => {
    vi.stubGlobal('fetch', respondWith(409, { success: false, error: 'conflict' }));
    const created = await queue();
    await drainOutbox();
    expect((await outboxList())[0]?.status).toBe('failed');

    vi.stubGlobal('fetch', respondWith(200));
    await retryOutboxItem(created.id);

    // The retry kicks off a drain; give the microtask queue a turn.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await outboxList()).toEqual([]);
  });
});
