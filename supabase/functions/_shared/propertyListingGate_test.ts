/**
 * New-booking gate for public property links.
 * Run: deno test --allow-env supabase/functions/_shared/propertyListingGate_test.ts
 */

import { assert, assertFalse, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  PROPERTY_NOT_ACCEPTING_BOOKINGS_CODE,
  propertyNotAcceptingBookingsError,
  propertyStatusAcceptsNewBookings,
} from './propertyListingGate.ts';

Deno.test('only an ACTIVE listing takes new bookings', () => {
  assert(propertyStatusAcceptsNewBookings('ACTIVE'));
  assert(propertyStatusAcceptsNewBookings('active'));
  assertFalse(propertyStatusAcceptsNewBookings('INACTIVE'));
  assertFalse(propertyStatusAcceptsNewBookings(null));
  assertFalse(propertyStatusAcceptsNewBookings(undefined));
  assertFalse(propertyStatusAcceptsNewBookings(''));
});

Deno.test('the guest-facing rejection carries a machine-readable prefix', () => {
  const error = propertyNotAcceptingBookingsError();
  assert(error.message.startsWith(`${PROPERTY_NOT_ACCEPTING_BOOKINGS_CODE}: `));
  assertEquals(error.message.split(': ')[1], "This place isn't taking new bookings right now.");
});
