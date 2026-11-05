/**
 * Source-contract leak audit: unpublished counterpart content must never leave
 * the authoring side (D2). Internal notes never leave the authoring org (D5).
 */

import { assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';

async function readFn(relativeFromTests: string): Promise<string> {
  return await Deno.readTextFile(new URL(relativeFromTests, import.meta.url));
}

Deno.test('received lists only return published guest reviews', async () => {
  const property = await readFn('../_shared/propertyReviewList.ts');
  const org = await readFn('../_shared/orgReviewList.ts');
  assert(property.includes(".eq('status', 'published')"));
  assert(org.includes(".eq('status', 'published')"));
  assert(!property.includes('internal_note'));
});

Deno.test('guest about-you hides unpublished host review content', async () => {
  const shared = await readFn('../_shared/guestMyReviews.ts');
  assert(shared.includes('hiddenUntilYouReview'));
  assert(shared.includes('hiddenUntilYouReview ? null'));
  assert(!shared.includes('internal_note,'));
  assert(shared.includes(".eq('guest_email', email)"));
  assert(!shared.includes('guest_email.eq.${'));
});

Deno.test('get-guest-review does not return host review fields', async () => {
  const source = await readFn('../get-guest-review/index.ts');
  assert(!source.includes('host_guest_reviews'));
  assert(!source.includes('getHostGuestReviewRow'));
  assert(!source.includes('internal_note'));
});

Deno.test('screening reputation omits internal notes and unpublished rows', async () => {
  const service = await readFn('../_shared/hostGuestReviewService.ts');
  assert(service.includes(".eq('status', 'published')"));
  assert(!service.includes('internal_note,'));
  const handler = await readFn('../get-guest-reputation/index.ts');
  assert(handler.includes('internalNote: hostReview.internal_note'));
  assert(handler.includes('current booking'));
});

Deno.test('AI draft of a guest response requires a published guest review', async () => {
  const source = await readFn('../draft-review-with-ai/index.ts');
  assert(source.includes("guestReview.status !== 'published'"));
  assert(!source.includes('upsertHostGuestReview'));
});

Deno.test('review emails and bells never interpolate unpublished review text', async () => {
  const emails = await readFn('../_shared/reviewEmails.ts');
  assert(!emails.includes('review_text'));
  assert(!emails.includes('reviewText'));
  const publishing = await readFn('../_shared/reviewPublishing.ts');
  assert(publishing.includes('left a review'));
  assert(!publishing.includes('review.review_text'));
  const lifecycle = await readFn('../_shared/reviewLifecycle.ts');
  assert(lifecycle.includes('Review ${guestName}'));
  assert(!lifecycle.includes('hostReview.review_text'));
});
