import { assertEquals, assertNotEquals } from 'jsr:@std/assert@1';

import {
  bookingPlaceholderIdentityKey,
  guestIdentityKey,
  identityKeyForEmail,
} from './guestIdentityKey.ts';

Deno.test('bookingPlaceholderIdentityKey is stable and booking-scoped', () => {
  assertEquals(bookingPlaceholderIdentityKey('abc-123'), 'booking:abc-123');
});

Deno.test('guestIdentityKey falls back to the booking placeholder with no email', async () => {
  const key = await guestIdentityKey(null, 'abc-123');
  assertEquals(key, 'booking:abc-123');
  const keyFromBlank = await guestIdentityKey('   ', 'abc-123');
  assertEquals(keyFromBlank, 'booking:abc-123');
});

Deno.test(
  'guestIdentityKey is deterministic and case/whitespace-insensitive for the same email',
  async () => {
    const a = await guestIdentityKey('Guest@Example.com', 'booking-1');
    const b = await guestIdentityKey('  guest@example.com  ', 'booking-2');
    assertEquals(a, b);
    assertNotEquals(a, 'booking:booking-1');
  }
);

Deno.test('guestIdentityKey differs between distinct emails', async () => {
  const a = await guestIdentityKey('guest-one@example.com', 'booking-1');
  const b = await guestIdentityKey('guest-two@example.com', 'booking-1');
  assertNotEquals(a, b);
});

Deno.test(
  'identityKeyForEmail returns null for no email, matches guestIdentityKey for a real one',
  async () => {
    assertEquals(await identityKeyForEmail(null), null);
    assertEquals(await identityKeyForEmail(''), null);

    const viaEmail = await identityKeyForEmail('guest@example.com');
    const viaBooking = await guestIdentityKey('guest@example.com', 'any-booking-id');
    assertEquals(viaEmail, viaBooking);
  }
);
