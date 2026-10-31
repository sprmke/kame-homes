import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import { redactSensitiveFields } from './redact.ts';

Deno.test('redactSensitiveFields — masks contact / identity fields at any depth', () => {
  const input = {
    bookingId: 'b1',
    primaryGuestName: 'Ana Cruz',
    guestEmail: 'ana@example.com',
    guests: [{ name: 'Ben', guest_phone_number: '09171234567', valid_id_number: 'X123' }],
    payment: { gcash_account_number: '0999', amount: 3500 },
  };
  assertEquals(redactSensitiveFields(input), {
    bookingId: 'b1',
    primaryGuestName: 'Ana Cruz',
    guestEmail: '[redacted]',
    guests: [{ name: 'Ben', guest_phone_number: '[redacted]', valid_id_number: '[redacted]' }],
    payment: { gcash_account_number: '[redacted]', amount: 3500 },
  });
});

Deno.test('redactSensitiveFields — masks secret tokens but not token counts', () => {
  assertEquals(
    redactSensitiveFields({ stay_guide_token: 'abc', accessToken: 'x', inputTokens: 120 }),
    { stay_guide_token: '[redacted]', accessToken: '[redacted]', inputTokens: 120 }
  );
});

Deno.test('redactSensitiveFields — leaves primitives and empty values alone', () => {
  assertEquals(redactSensitiveFields('text'), 'text');
  assertEquals(redactSensitiveFields({ email: null, phone: '' }), { email: null, phone: '' });
});
