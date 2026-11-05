import {
  bookingDateKey,
  findAdoptableManualBooking,
  findRelinkableBooking,
  isAirbnbBookingSource,
  isPastReservation,
  type IngestBookingRow,
} from './externalBookingIngest.ts';

import {
  assert,
  assertEquals,
  assertFalse,
} from 'https://deno.land/std@0.224.0/testing/asserts.ts';

function row(overrides: Partial<IngestBookingRow>): IngestBookingRow {
  return {
    id: 'row-1',
    status: 'PENDING_REVIEW',
    check_in_date: '11-20-2026',
    check_out_date: '11-23-2026',
    booking_source: 'Airbnb',
    external_uid: null,
    external_feed_id: null,
    ...overrides,
  };
}

Deno.test('bookingDateKey normalizes both stored date formats', () => {
  assertEquals(bookingDateKey('11-20-2026', '11-23-2026'), '2026-11-20|2026-11-23');
  assertEquals(bookingDateKey('2026-11-20', '2026-11-23'), '2026-11-20|2026-11-23');
  assertEquals(bookingDateKey('not-a-date', '2026-11-23'), null);
});

Deno.test('isPastReservation only trips for a checkout before today', () => {
  assert(isPastReservation('2026-11-19', '2026-11-20'));
  assertFalse(isPastReservation('2026-11-20', '2026-11-20'));
  assertFalse(isPastReservation('2026-11-21', '2026-11-20'));
});

Deno.test('findRelinkableBooking finds an orphan from a removed feed', () => {
  const orphan = row({ external_uid: 'uid-1', external_feed_id: null });
  const found = findRelinkableBooking(
    [orphan, row({ id: 'other', external_uid: 'uid-2', external_feed_id: 'feed-a' })],
    'uid-1',
    'feed-b'
  );
  assertEquals(found?.id, 'row-1');
});

Deno.test('findRelinkableBooking ignores the same feed and cancelled rows', () => {
  const sameFeed = row({ external_uid: 'uid-1', external_feed_id: 'feed-a' });
  assertEquals(findRelinkableBooking([sameFeed], 'uid-1', 'feed-a'), null);

  const cancelled = row({
    status: 'CANCELLED',
    external_uid: 'uid-1',
    external_feed_id: null,
  });
  assertEquals(findRelinkableBooking([cancelled], 'uid-1', 'feed-b'), null);
});

Deno.test('findAdoptableManualBooking matches exact dates, source, and no provenance', () => {
  const manual = row({ booking_source: 'airbnb' });
  const found = findAdoptableManualBooking(
    [manual, row({ id: 'other', check_in_date: '12-01-2026', check_out_date: '12-03-2026' })],
    { checkInYmd: '2026-11-20', checkOutYmd: '2026-11-23', bookingSource: 'Airbnb' }
  );
  assertEquals(found?.id, 'row-1');
});

Deno.test('findAdoptableManualBooking refuses rows with provenance or another source', () => {
  const alreadyLinked = row({ external_uid: 'uid-1', external_feed_id: 'feed-a' });
  assertEquals(
    findAdoptableManualBooking([alreadyLinked], {
      checkInYmd: '2026-11-20',
      checkOutYmd: '2026-11-23',
      bookingSource: 'Airbnb',
    }),
    null
  );

  const direct = row({ booking_source: 'Direct' });
  assertEquals(
    findAdoptableManualBooking([direct], {
      checkInYmd: '2026-11-20',
      checkOutYmd: '2026-11-23',
      bookingSource: 'Airbnb',
    }),
    null
  );
});

Deno.test('isAirbnbBookingSource is trimmed and case insensitive', () => {
  assert(isAirbnbBookingSource(' Airbnb '));
  assert(isAirbnbBookingSource('AIRBNB'));
  assertFalse(isAirbnbBookingSource('Facebook'));
  assertFalse(isAirbnbBookingSource(null));
});
