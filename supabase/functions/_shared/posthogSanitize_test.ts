import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import { sanitizePostHogProperties } from './posthogSanitize.ts';

Deno.test('sanitizePostHogProperties strips email and tokens', () => {
  const out = sanitizePostHogProperties({
    booking_source: 'Facebook',
    guest_email: 'secret@example.com',
    access: 'abc123',
    nights: 3,
  });
  assertEquals(out.booking_source, 'Facebook');
  assertEquals(out.nights, 3);
  assertEquals('guest_email' in out, false);
  assertEquals('access' in out, false);
});
