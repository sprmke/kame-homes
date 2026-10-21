import { assertEquals } from 'jsr:@std/assert@1';

import {
  normalizeReviewText,
  REVIEW_RESPONSE_MAX_LEN,
  validateReviewText,
} from './reviewContentPolicy.ts';

Deno.test('normalizeReviewText collapses whitespace and trims', () => {
  assertEquals(normalizeReviewText('  great   stay\n\nwould  return  '), 'great stay would return');
});

Deno.test('normalizeReviewText returns null for empty/whitespace-only input', () => {
  assertEquals(normalizeReviewText(''), null);
  assertEquals(normalizeReviewText('   '), null);
  assertEquals(normalizeReviewText(null), null);
  assertEquals(normalizeReviewText(undefined), null);
});

Deno.test('validateReviewText: null/empty always passes (optional field)', () => {
  assertEquals(validateReviewText(null), null);
});

Deno.test('validateReviewText: enforces max length with a custom field label', () => {
  const tooLong = 'x'.repeat(REVIEW_RESPONSE_MAX_LEN + 1);
  const err = validateReviewText(tooLong, {
    maxLen: REVIEW_RESPONSE_MAX_LEN,
    fieldLabel: 'Response',
  });
  assertEquals(err, `Response must be ${REVIEW_RESPONSE_MAX_LEN} characters or fewer`);
});

Deno.test('validateReviewText: rejects links, emails, and phone numbers (D15)', () => {
  assertEquals(
    validateReviewText('contact me at https://example.com'),
    "Review text can't include links"
  );
  assertEquals(
    validateReviewText('email me at guest@example.com'),
    "Review text can't include an email address"
  );
  assertEquals(
    validateReviewText('call 0917 123 4567 anytime'),
    "Review text can't include a phone number"
  );
});

Deno.test('validateReviewText: allowContactInfo bypasses the contact-info checks', () => {
  assertEquals(
    validateReviewText('reach me at guest@example.com', { allowContactInfo: true }),
    null
  );
});

Deno.test('validateReviewText: clean text passes', () => {
  assertEquals(validateReviewText('Wonderful host, very clean place.'), null);
});
