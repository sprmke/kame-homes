/**
 * Source contracts for guest Reviews page endpoints.
 */

import { assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';

Deno.test('list-my-reviews is guest JWT GET with three tabs', async () => {
  const source = await Deno.readTextFile(new URL('../list-my-reviews/index.ts', import.meta.url));
  assert(source.includes("serveAuthenticated('list-my-reviews'"));
  assert(source.includes('to_write'));
  assert(source.includes('by_you'));
  assert(source.includes('about_you'));
  const shared = await Deno.readTextFile(new URL('../_shared/guestMyReviews.ts', import.meta.url));
  assert(shared.includes('hiddenUntilYouReview'));
  assert(shared.includes('select') && !shared.includes('internal_note,'));
  assert(shared.includes(".eq('guest_email', email)"));
  assert(!shared.includes('guest_email.eq.${'));
});

Deno.test('respond-to-host-review requires published ownership', async () => {
  const source = await Deno.readTextFile(
    new URL('../respond-to-host-review/index.ts', import.meta.url)
  );
  assert(source.includes('guestOwnsHostReview'));
  assert(source.includes('respondToHostReview'));
  assert(source.includes('review_response_received'));
});
