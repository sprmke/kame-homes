import {
  validateGuestFormCheckOutAfterCheckIn,
  validateGuestFormFormatFields,
} from './guestFormSubmitValidation.ts';
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

Deno.test('validateGuestFormFormatFields rejects invalid email and phone', () => {
  const form = new FormData();
  form.set('guestFacebookName', 'Jane Guest');
  form.set('guestEmail', 'not-an-email');
  form.set('guestPhoneNumber', '08123456789');
  form.set('numberOfAdults', '1');

  const result = validateGuestFormFormatFields(form);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.message, 'Please enter a valid email address');
  }
});

Deno.test('validateGuestFormFormatFields accepts valid payload', () => {
  const form = new FormData();
  form.set('guestFacebookName', 'Jane Guest');
  form.set('guestEmail', 'jane@example.com');
  form.set('guestPhoneNumber', '09171234567');
  form.set('numberOfAdults', '2');

  assertEquals(validateGuestFormFormatFields(form), { ok: true });
});

Deno.test('validateGuestFormCheckOutAfterCheckIn rejects same-day or inverted stays', () => {
  assertEquals(validateGuestFormCheckOutAfterCheckIn('2026-01-10', '2026-01-10').ok, false);
  assertEquals(validateGuestFormCheckOutAfterCheckIn('2026-01-12', '2026-01-10').ok, false);
  assertEquals(validateGuestFormCheckOutAfterCheckIn('2026-01-10', '2026-01-12').ok, true);
});
