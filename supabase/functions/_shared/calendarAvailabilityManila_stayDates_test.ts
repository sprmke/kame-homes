import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  bookingOccupiesNight,
  collectBlockedNights,
} from './calendarAvailabilityManila.ts';

Deno.test('collectBlockedNights — same-day stay blocks its check-in night', () => {
  const blocked = collectBlockedNights([{ checkInYmd: '2026-01-10', checkOutYmd: '2026-01-10' }]);
  assertEquals([...blocked], ['2026-01-10']);
});

Deno.test('collectBlockedNights — normal range blocks each night, skips inverted rows', () => {
  const blocked = collectBlockedNights([
    { checkInYmd: '2026-01-10', checkOutYmd: '2026-01-12' },
    { checkInYmd: '2026-01-20', checkOutYmd: '2026-01-19' },
  ]);
  assertEquals([...blocked], ['2026-01-10', '2026-01-11']);
});

Deno.test('bookingOccupiesNight — same-day stay occupies its day only', () => {
  assertEquals(bookingOccupiesNight('2026-01-10', '2026-01-10', '2026-01-10'), true);
  assertEquals(bookingOccupiesNight('2026-01-10', '2026-01-10', '2026-01-11'), false);
  assertEquals(bookingOccupiesNight('2026-01-10', '2026-01-12', '2026-01-11'), true);
  assertEquals(bookingOccupiesNight('2026-01-10', '2026-01-12', '2026-01-12'), false);
});
