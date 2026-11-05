import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { matchesDefaultBookingsListVisibility } from './bookingsListSort.ts';

Deno.test('matchesDefaultBookingsListVisibility hides cancelled and completed by default', () => {
  assertEquals(matchesDefaultBookingsListVisibility({ status: 'CANCELLED' }), false);
  assertEquals(matchesDefaultBookingsListVisibility({ status: 'COMPLETED' }), false);
  assertEquals(matchesDefaultBookingsListVisibility({ status: 'READY_FOR_CHECKIN' }), true);
});

Deno.test(
  'matchesDefaultBookingsListVisibility shows completed when showCompletedBookings is on',
  () => {
    assertEquals(matchesDefaultBookingsListVisibility({ status: 'COMPLETED' }, true), true);
    assertEquals(matchesDefaultBookingsListVisibility({ status: 'CANCELLED' }, true), false);
  }
);

Deno.test(
  'matchesDefaultBookingsListVisibility honors History-style status filter for completed and cancelled',
  () => {
    const history = ['COMPLETED', 'CANCELLED', 'IMPORTED', 'NO_HOST_AVAILABLE'] as const;
    assertEquals(
      matchesDefaultBookingsListVisibility({ status: 'COMPLETED' }, false, history),
      true
    );
    assertEquals(
      matchesDefaultBookingsListVisibility({ status: 'CANCELLED' }, false, history),
      true
    );
    assertEquals(
      matchesDefaultBookingsListVisibility({ status: 'IMPORTED' }, false, history),
      true
    );
  }
);
