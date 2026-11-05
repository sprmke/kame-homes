import { assertEquals, assertFalse } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { computeTotalGuestBalanceFromBooking, isAirbnbBookingSource } from './totalGuestBalance.ts';

Deno.test('isAirbnbBookingSource is trimmed and case insensitive', () => {
  assertEquals(isAirbnbBookingSource(' Airbnb '), true);
  assertEquals(isAirbnbBookingSource('airbnb'), true);
  assertFalse(isAirbnbBookingSource('Facebook'));
  assertFalse(isAirbnbBookingSource(null));
});

Deno.test('Airbnb total excludes rate, down payment, and security deposit', () => {
  assertEquals(
    computeTotalGuestBalanceFromBooking({
      booking_rate: 10000,
      down_payment: 2000,
      security_deposit: 3000,
      guest_additional_fee: 200,
      booking_source: 'airbnb',
    }),
    200
  );
});
