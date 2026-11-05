import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import { outboxAdd, outboxClear, outboxCount, outboxList, outboxRemove, outboxUpdate } from '@/lib/pwa/outbox';

function item(overrides: Partial<Parameters<typeof outboxAdd>[0]> = {}) {
  return {
    kind: 'inbox-reply',
    label: 'Reply to guest',
    url: 'https://example.supabase.co/functions/v1/social-inbox-send',
    method: 'POST' as const,
    headers: {},
    body: JSON.stringify({ text: 'hello' }),
    idempotencyKey: 'key-1',
    invalidateKeys: ['inbox-messages'],
    ...overrides,
  };
}

beforeEach(async () => {
  await outboxClear();
});

describe('offline outbox', () => {
  it('queues an item with a generated id and FIFO metadata', async () => {
    const created = await outboxAdd(item());
    expect(created.id).toBeTruthy();
    expect(created.status).toBe('pending');
    expect(created.attempts).toBe(0);
    expect(created.createdAt).toBeGreaterThan(0);
  });

  it('lists items oldest first', async () => {
    const first = await outboxAdd(item({ label: 'first' }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await outboxAdd(item({ label: 'second' }));
    const list = await outboxList();
    expect(list.map((entry) => entry.id)).toEqual([first.id, second.id]);
  });

  it('updates an item in place, keeping unknown fields', async () => {
    const created = await outboxAdd(item());
    await outboxUpdate(created.id, { attempts: 3, lastError: 'HTTP 503' });
    const [entry] = await outboxList();
    expect(entry).toMatchObject({ id: created.id, attempts: 3, lastError: 'HTTP 503' });
    expect(entry?.idempotencyKey).toBe('key-1');
  });

  it('ignores an update for a missing item', async () => {
    await expect(outboxUpdate('missing', { attempts: 1 })).resolves.toBeUndefined();
  });

  it('removes an item', async () => {
    const created = await outboxAdd(item());
    await outboxRemove(created.id);
    expect(await outboxCount()).toBe(0);
    expect(await outboxList()).toEqual([]);
  });

  it('clears everything (logout / kill-switch purge)', async () => {
    await outboxAdd(item({ idempotencyKey: 'a' }));
    await outboxAdd(item({ idempotencyKey: 'b' }));
    expect(await outboxCount()).toBe(2);
    await outboxClear();
    expect(await outboxCount()).toBe(0);
  });

  it('keeps the idempotency key stable across updates (replay safety)', async () => {
    const created = await outboxAdd(item());
    await outboxUpdate(created.id, { status: 'failed', attempts: 6 });
    const [entry] = await outboxList();
    expect(entry?.idempotencyKey).toBe(created.idempotencyKey);
  });
});
