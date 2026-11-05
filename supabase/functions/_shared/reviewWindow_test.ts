import { assertEquals } from 'jsr:@std/assert@1';

import { computeReviewWindow, isWindowOpen, REVIEW_WINDOW_DAYS } from './reviewWindow.ts';

Deno.test('REVIEW_WINDOW_DAYS is 14 (D1)', () => {
  assertEquals(REVIEW_WINDOW_DAYS, 14);
});

Deno.test(
  'computeReviewWindow opens at check-out midnight Manila when check-out is in the past',
  () => {
    const { opensAt, closesAt } = computeReviewWindow('2026-01-10', '2026-01-15T00:00:00.000Z');
    // 2026-01-10T00:00:00+08:00 == 2026-01-09T16:00:00Z
    assertEquals(opensAt, '2026-01-09T16:00:00.000Z');
    // closes 14 days after check-out, 23:59:59 Manila == 23:59:59 - 08:00 = 15:59:59Z next day
    assertEquals(closesAt, '2026-01-24T15:59:59.000Z');
  }
);

Deno.test('computeReviewWindow opens at now when check-out is in the future', () => {
  const now = '2026-01-05T03:00:00.000Z';
  const { opensAt } = computeReviewWindow('2026-01-10', now);
  assertEquals(opensAt, now);
});

Deno.test(
  'computeReviewWindow handles missing/invalid check-out date by falling back to now',
  () => {
    const now = '2026-02-01T10:00:00.000Z';
    const { opensAt, closesAt } = computeReviewWindow('', now);
    assertEquals(opensAt, now);
    // Falls back to opens-date-based close window (14 days later, end of day Manila).
    assertEquals(closesAt > opensAt, true);
  }
);

Deno.test('computeReviewWindow for a checkout older than 14 days is already closed', () => {
  const now = '2026-02-01T00:00:00.000Z';
  const { closesAt } = computeReviewWindow('2026-01-10', now);
  assertEquals(Date.parse(closesAt) < Date.parse(now), true);
});

Deno.test('isWindowOpen is false once published, regardless of closes_at', () => {
  const window = {
    closes_at: '2099-01-01T00:00:00.000Z',
    published_at: '2026-01-01T00:00:00.000Z',
  };
  assertEquals(isWindowOpen(window), false);
});

Deno.test('isWindowOpen is true before closes_at and false after', () => {
  const window = { closes_at: '2026-01-15T00:00:00.000Z', published_at: null };
  assertEquals(isWindowOpen(window, new Date('2026-01-14T23:59:59.000Z')), true);
  assertEquals(isWindowOpen(window, new Date('2026-01-15T00:00:01.000Z')), false);
});
