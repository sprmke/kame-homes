import {
  authorizeGuestBookingAccess,
  guestBookingAccessEnforced,
  mintGuestBookingAccessToken,
  verifyGuestBookingAccessToken,
} from './guestBookingAccessToken.ts';

const BOOKING_ID = '11111111-1111-1111-1111-111111111111';

Deno.test('mint + verify round-trip', async () => {
  Deno.env.set('GUEST_BOOKING_ACCESS_SECRET', 'test-secret-for-deno');
  const token = await mintGuestBookingAccessToken(BOOKING_ID);
  const verified = await verifyGuestBookingAccessToken(token);
  if (!verified.ok || verified.bookingId !== BOOKING_ID) {
    throw new Error('expected valid token');
  }
});

Deno.test('authorizeGuestBookingAccess allows legacy when enforcement off', async () => {
  Deno.env.set('GUEST_BOOKING_ACCESS_ENFORCE', 'false');
  Deno.env.set('GUEST_BOOKING_ACCESS_SECRET', 'test-secret-for-deno');
  const result = await authorizeGuestBookingAccess({
    bookingIdFromPath: BOOKING_ID,
    accessTokenFromQuery: null,
  });
  if (!result.ok) throw new Error('legacy path should pass when enforcement off');
});

Deno.test('authorizeGuestBookingAccess rejects missing token when enforced', async () => {
  Deno.env.set('GUEST_BOOKING_ACCESS_ENFORCE', 'true');
  Deno.env.set('GUEST_BOOKING_ACCESS_SECRET', 'test-secret-for-deno');
  Deno.env.set('GUEST_BOOKING_ACCESS_LEGACY_GRACE_DAYS', '0');
  const result = await authorizeGuestBookingAccess({
    bookingIdFromPath: BOOKING_ID,
    accessTokenFromQuery: null,
    bookingCreatedAt: new Date().toISOString(),
  });
  if (result.ok || result.status !== 401) {
    throw new Error('expected 401 when enforced without token');
  }
});

Deno.test('authorizeGuestBookingAccess allows legacy inside grace when enforced', async () => {
  Deno.env.set('GUEST_BOOKING_ACCESS_ENFORCE', 'true');
  Deno.env.set('GUEST_BOOKING_ACCESS_SECRET', 'test-secret-for-deno');
  Deno.env.set('GUEST_BOOKING_ACCESS_LEGACY_GRACE_DAYS', '30');
  const result = await authorizeGuestBookingAccess({
    bookingIdFromPath: BOOKING_ID,
    accessTokenFromQuery: null,
    bookingCreatedAt: new Date().toISOString(),
  });
  if (!result.ok) throw new Error('expected grace pass for recent booking');
});

Deno.test('guestBookingAccessEnforced reads env', () => {
  Deno.env.set('GUEST_BOOKING_ACCESS_ENFORCE', 'true');
  if (!guestBookingAccessEnforced()) throw new Error('expected true');
  Deno.env.set('GUEST_BOOKING_ACCESS_ENFORCE', 'false');
  if (guestBookingAccessEnforced()) throw new Error('expected false');
});

Deno.test('authorizeGuestBookingAccess rejects mismatched write-path token', async () => {
  Deno.env.set('GUEST_BOOKING_ACCESS_ENFORCE', 'true');
  Deno.env.set('GUEST_BOOKING_ACCESS_SECRET', 'test-secret-for-deno');
  Deno.env.set('GUEST_BOOKING_ACCESS_LEGACY_GRACE_DAYS', '0');
  const otherToken = await mintGuestBookingAccessToken('22222222-2222-2222-2222-222222222222');
  const result = await authorizeGuestBookingAccess({
    bookingIdFromPath: BOOKING_ID,
    accessTokenFromQuery: otherToken,
    bookingCreatedAt: '2020-01-01T00:00:00.000Z',
  });
  if (result.ok || result.status !== 401) {
    throw new Error('expected 401 for token bound to a different booking');
  }
});

Deno.test(
  'authorizeGuestBookingAccess accepts matching write-path token when enforced',
  async () => {
    Deno.env.set('GUEST_BOOKING_ACCESS_ENFORCE', 'true');
    Deno.env.set('GUEST_BOOKING_ACCESS_SECRET', 'test-secret-for-deno');
    Deno.env.set('GUEST_BOOKING_ACCESS_LEGACY_GRACE_DAYS', '0');
    const token = await mintGuestBookingAccessToken(BOOKING_ID);
    const result = await authorizeGuestBookingAccess({
      bookingIdFromPath: BOOKING_ID,
      accessTokenFromQuery: token,
      bookingCreatedAt: '2020-01-01T00:00:00.000Z',
    });
    if (!result.ok) throw new Error('expected matching token to pass');
  }
);
