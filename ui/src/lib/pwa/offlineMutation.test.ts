import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { QueryClient } from '@tanstack/react-query';

vi.mock('@/features/dashboard/org/lib/edgeClient', () => ({
  getSessionJwt: async () => 'test-jwt',
}));

const { runOfflineMutation } = await import('@/lib/pwa/offlineMutation');
const { outboxClear, outboxList } = await import('@/lib/pwa/outbox');

const queryClient = {
  invalidateQueries: vi.fn(async () => {}),
} as unknown as QueryClient;

const spec = {
  kind: 'notifications-mark-read',
  label: 'Mark notification read',
  url: 'https://example.supabase.co/functions/v1/notifications-mark-read',
  body: { notificationId: 'n1' },
  invalidateKeys: ['notifications'],
};

beforeEach(async () => {
  await outboxClear();
  vi.unstubAllGlobals();
  vi.stubGlobal('navigator', { onLine: true });
});

describe('runOfflineMutation', () => {
  it('runs online and returns the server payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ success: true, data: { markedCount: 1 } }), { status: 200 })
      )
    );
    const result = await runOfflineMutation<{ markedCount: number }>(spec, queryClient);
    expect(result).toEqual({ queued: false, data: { markedCount: 1 } });
    expect(await outboxList()).toEqual([]);
  });

  it('queues on a transport failure and applies the optimistic update', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      })
    );
    const applyOptimistic = vi.fn();
    const result = await runOfflineMutation({ ...spec, applyOptimistic }, queryClient);
    expect(result).toEqual({ queued: true, data: null });
    expect(applyOptimistic).toHaveBeenCalledWith(queryClient);
    const [item] = await outboxList();
    expect(item).toMatchObject({ kind: spec.kind, status: 'pending' });
    expect(item?.idempotencyKey).toBeTruthy();
  });

  it('queues immediately when already offline', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await runOfflineMutation(spec, queryClient);
    expect(result.queued).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('re-throws a server rejection instead of queueing it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ success: false, error: 'Notification not found' }), {
            status: 404,
          })
      )
    );
    await expect(runOfflineMutation(spec, queryClient)).rejects.toThrow('Notification not found');
    expect(await outboxList()).toEqual([]);
  });
});
