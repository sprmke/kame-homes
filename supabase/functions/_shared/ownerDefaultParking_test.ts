/**
 * Owner-default parking flags — pure settings readers.
 * Run: deno test supabase/functions/_shared/ownerDefaultParking_test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  readComplimentaryOwnerParking,
  readPreferredOwnerParkingId,
} from './ownerDefaultParkingFlags.ts';

Deno.test('readComplimentaryOwnerParking - requires Allow Parking and the flag', () => {
  assertEquals(
    readComplimentaryOwnerParking({ allowParking: true, complimentaryOwnerParking: true }),
    true
  );
  assertEquals(
    readComplimentaryOwnerParking({ allowParking: false, complimentaryOwnerParking: true }),
    false
  );
  assertEquals(
    readComplimentaryOwnerParking({ allowParking: true, complimentaryOwnerParking: false }),
    false
  );
  assertEquals(readComplimentaryOwnerParking({}), false);
  assertEquals(
    readComplimentaryOwnerParking({ allowParking: 'true', complimentaryOwnerParking: 'true' }),
    false
  );
  assertEquals(readComplimentaryOwnerParking(null), false);
  assertEquals(readComplimentaryOwnerParking('nope'), false);
});

Deno.test('readPreferredOwnerParkingId - trims or ignores junk', () => {
  assertEquals(readPreferredOwnerParkingId({ preferredOwnerParkingId: '  abc  ' }), 'abc');
  assertEquals(readPreferredOwnerParkingId({ preferredOwnerParkingId: '   ' }), null);
  assertEquals(readPreferredOwnerParkingId({ preferredOwnerParkingId: 42 }), null);
  assertEquals(readPreferredOwnerParkingId(null), null);
});
