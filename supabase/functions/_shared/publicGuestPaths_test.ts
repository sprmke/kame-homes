import { appendGuestBookingAccessQuery, guestSdFormPath } from './publicGuestPaths.ts';

Deno.test('appendGuestBookingAccessQuery adds access param', () => {
  const url = appendGuestBookingAccessQuery(
    'https://app.test/properties/demo/sd-form?bookingId=abc',
    'tok+1'
  );
  const parsed = new URL(url);
  if (parsed.searchParams.get('access') !== 'tok+1') {
    throw new Error('expected access query');
  }
});

Deno.test('guestSdFormPath includes access when provided', () => {
  const url = guestSdFormPath(
    'https://app.test',
    'demo',
    '11111111-1111-1111-1111-111111111111',
    'tok'
  );
  if (!url.includes('access=tok')) throw new Error('missing access in sd form url');
});
