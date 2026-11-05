import { assertEquals } from 'jsr:@std/assert@1';

import { decodeReviewCursor, encodeReviewCursor, isAfterReviewCursor } from './reviewCursor.ts';

const A = '0b3f1c2e-1111-4111-8111-111111111111';
const B = '0b3f1c2e-2222-4222-8222-222222222222';

Deno.test('decodeReviewCursor round-trips an encoded cursor', () => {
  const cursor = decodeReviewCursor(encodeReviewCursor('2026-10-24T15:59:59.000Z', A));
  assertEquals(cursor, { at: '2026-10-24T15:59:59.000Z', id: A });
});

Deno.test('decodeReviewCursor rejects malformed input', () => {
  assertEquals(decodeReviewCursor(null), null);
  assertEquals(decodeReviewCursor(''), null);
  assertEquals(decodeReviewCursor('2026-10-24T15:59:59.000Z'), null);
  assertEquals(decodeReviewCursor(`not-a-date|${A}`), null);
  assertEquals(decodeReviewCursor('2026-10-24T15:59:59.000Z|not-a-uuid'), null);
});

Deno.test('isAfterReviewCursor breaks closes_at ties by id', () => {
  const at = '2026-10-24T15:59:59.000Z';
  const cursor = { at, id: A };
  assertEquals(isAfterReviewCursor({ at, id: A }, cursor), false);
  assertEquals(isAfterReviewCursor({ at, id: B }, cursor), true);
  assertEquals(isAfterReviewCursor({ at: '2026-10-24T15:59:58.000Z', id: B }, cursor), false);
  assertEquals(isAfterReviewCursor({ at: '2026-10-25T15:59:59.000Z', id: A }, cursor), true);
  assertEquals(isAfterReviewCursor({ at, id: A }, null), true);
});
