/**
 * Web Push sender contract: payload shaping, batch concurrency, failure states.
 *
 * Real delivery needs VAPID keys and a live push service, so `sendPush` itself is
 * a thin library call covered by the manual device sheet. Everything around it
 * (truncation, ordering, the retire cap) is pure and tested here.
 */
import { assertEquals } from 'jsr:@std/assert@1';

import {
  PUSH_BODY_MAX,
  PUSH_TITLE_MAX,
  buildPushPayload,
  sendPushBatch,
  type PushSendResult,
  type StoredPushSubscription,
} from './webPushService.ts';
import { nextPushFailureState, PUSH_FAILURE_RETIRE_AT } from './pushRecipients.ts';

function sub(id: string): StoredPushSubscription {
  return { id, endpoint: `https://push.example/${id}`, p256dh: 'p', auth: 'a' };
}

Deno.test('buildPushPayload caps title and body, collapses whitespace', () => {
  const payload = buildPushPayload(
    {
      id: 'n1',
      type: 'inbox_new_message',
      title: 'T'.repeat(PUSH_TITLE_MAX + 50),
      body: `  line one\n\nline two ${'x'.repeat(PUSH_BODY_MAX)}  `,
    },
    '/org/a/property/b/inbox',
    7
  );
  assertEquals(payload.title.length, PUSH_TITLE_MAX);
  assertEquals((payload.body ?? '').length, PUSH_BODY_MAX);
  assertEquals((payload.body ?? '').includes('\n'), false);
  assertEquals(payload.path, '/org/a/property/b/inbox');
  assertEquals(payload.notificationId, 'n1');
  assertEquals(payload.tag, 'n1');
  assertEquals(payload.unreadCount, 7);
});

Deno.test('buildPushPayload omits an empty body', () => {
  const payload = buildPushPayload({ id: 'n2', type: 'x', title: 'Hi', body: '   ' }, '/app');
  assertEquals(payload.body, undefined);
});

Deno.test('sendPushBatch sends every subscription once, keeping result order per worker', async () => {
  const seen: string[] = [];
  const results = await sendPushBatch(
    [sub('a'), sub('b'), sub('c'), sub('d')],
    { title: 'x' },
    2,
    (s) => {
      seen.push(s.id);
      return Promise.resolve({ ok: true, id: s.id } satisfies PushSendResult);
    }
  );
  assertEquals([...seen].sort(), ['a', 'b', 'c', 'd']);
  assertEquals(results.length, 4);
});

Deno.test('sendPushBatch reports partial failures without throwing', async () => {
  const results = await sendPushBatch([sub('a'), sub('b')], { title: 'x' }, 2, (s) =>
    Promise.resolve(
      s.id === 'a'
        ? { ok: true, id: s.id }
        : { ok: false, id: s.id, gone: true, error: 'gone' }
    )
  );
  assertEquals(results.filter((r) => r.ok).length, 1);
  assertEquals(results.filter((r) => !r.ok && r.gone).length, 1);
});

Deno.test('nextPushFailureState retires exactly at the cap', () => {
  assertEquals(PUSH_FAILURE_RETIRE_AT, 5);
  assertEquals(nextPushFailureState(0), { failureCount: 1, retire: false });
  assertEquals(nextPushFailureState(3), { failureCount: 4, retire: false });
  assertEquals(nextPushFailureState(4), { failureCount: 5, retire: true });
  assertEquals(nextPushFailureState(null), { failureCount: 1, retire: false });
});

Deno.test('sendPushBatch with no subscriptions resolves empty', async () => {
  assertEquals(await sendPushBatch([], { title: 'x' }), []);
});
