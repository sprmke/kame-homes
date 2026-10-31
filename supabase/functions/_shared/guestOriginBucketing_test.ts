import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { bucketGuestOrigin } from './guestOriginBucketing.ts';

Deno.test('bucketGuestOrigin: empty → Unknown', () => {
  assertEquals(bucketGuestOrigin(null, null), 'Unknown');
  assertEquals(bucketGuestOrigin('', '  '), 'Unknown');
});

Deno.test('bucketGuestOrigin: PH city + province', () => {
  assertEquals(bucketGuestOrigin('123 Ayala Ave, Makati', null), 'Makati, Metro Manila');
  assertEquals(bucketGuestOrigin('Quezon City', 'Filipino'), 'Quezon City, Metro Manila');
  assertEquals(bucketGuestOrigin('Lapu-Lapu City', null), 'Lapu-Lapu, Cebu');
  assertEquals(bucketGuestOrigin('Cebu City', null), 'Cebu City, Cebu');
  assertEquals(bucketGuestOrigin('Davao', null), 'Davao City, Davao del Sur');
  assertEquals(bucketGuestOrigin('Bacoor Cavite', null), 'Bacoor, Cavite');
});

Deno.test('bucketGuestOrigin: NCR catch-all and province-only', () => {
  assertEquals(bucketGuestOrigin('Metro Manila', null), 'Manila, Metro Manila');
  assertEquals(bucketGuestOrigin('somewhere in Bulacan', null), 'Bulacan');
});

Deno.test('bucketGuestOrigin: country fallback when no PH city', () => {
  assertEquals(bucketGuestOrigin(null, 'Singapore'), 'Singapore');
  assertEquals(bucketGuestOrigin('Kuala Lumpur', 'Malaysian'), 'Malaysia');
});

Deno.test('bucketGuestOrigin: PH address wins over foreign nationality', () => {
  assertEquals(bucketGuestOrigin('Pasig City', 'American'), 'Pasig, Metro Manila');
});
