import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { mintGuestBookingAccessToken } from './guestBookingAccessToken.ts';
import { authorizeGuestTripAccess } from './guestTripAccess.ts';

const BOOKING_ID = '22222222-2222-2222-2222-222222222222';
const OTHER_ID = '33333333-3333-3333-3333-333333333333';
const OWNER = { id: 'user-owner', email: 'guest@example.com' };

function setSecret() {
  Deno.env.set('GUEST_BOOKING_ACCESS_SECRET', 'test-secret-for-deno');
  // Bare booking ids must never pass here, even with enforcement off.
  Deno.env.set('GUEST_BOOKING_ACCESS_ENFORCE', 'false');
}

Deno.test('trip access: valid token for this booking passes without a session', async () => {
  setSecret();
  const accessToken = await mintGuestBookingAccessToken(BOOKING_ID);
  const result = await authorizeGuestTripAccess({
    booking: { id: BOOKING_ID, guest_user_id: 'someone-else' },
    accessToken,
    user: null,
  });
  assertEquals(result, { ok: true, via: 'token' });
});

Deno.test('trip access: token minted for another booking is ignored', async () => {
  setSecret();
  const accessToken = await mintGuestBookingAccessToken(OTHER_ID);
  const result = await authorizeGuestTripAccess({
    booking: { id: BOOKING_ID, guest_user_id: OWNER.id },
    accessToken,
    user: null,
  });
  assertEquals(result, { ok: false, reason: 'sign_in_required' });
});

Deno.test('trip access: bare booking id without session asks to sign in', async () => {
  setSecret();
  const result = await authorizeGuestTripAccess({
    booking: { id: BOOKING_ID, guest_user_id: null, guest_email: OWNER.email },
    accessToken: null,
    user: null,
  });
  assertEquals(result, { ok: false, reason: 'sign_in_required' });
});

Deno.test('trip access: signed-in owner passes', async () => {
  setSecret();
  const result = await authorizeGuestTripAccess({
    booking: { id: BOOKING_ID, guest_user_id: OWNER.id },
    accessToken: null,
    user: OWNER,
  });
  assertEquals(result, { ok: true, via: 'owner' });
});

Deno.test('trip access: signed-in non-owner is forbidden', async () => {
  setSecret();
  const result = await authorizeGuestTripAccess({
    booking: { id: BOOKING_ID, guest_user_id: 'user-other', guest_email: OWNER.email },
    accessToken: null,
    user: OWNER,
  });
  assertEquals(result, { ok: false, reason: 'forbidden' });
});

Deno.test('trip access: unlinked booking with a different email is forbidden', async () => {
  setSecret();
  const result = await authorizeGuestTripAccess({
    booking: { id: BOOKING_ID, guest_user_id: null, guest_email: 'other@example.com' },
    accessToken: null,
    user: OWNER,
  });
  assertEquals(result, { ok: false, reason: 'forbidden' });
});
