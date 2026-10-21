/**
 * Source-contract tests for host Reviews page handlers.
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { allTeamPermissions } from '../_shared/propertyTeamPermissions.ts';
import { SEEDED_TEMPLATE_PERMISSIONS } from '../_shared/propertyTeamTemplates.ts';

const READ_ONLY = SEEDED_TEMPLATE_PERMISSIONS.READ_ONLY as readonly string[];
const FULL_ACCESS = allTeamPermissions() as readonly string[];
const OPERATIONS = SEEDED_TEMPLATE_PERMISSIONS.OPERATIONS as readonly string[];

Deno.test(
  'list-property-reviews requires reviews:view and published-only received tab',
  async () => {
    const source = await Deno.readTextFile(
      new URL('../list-property-reviews/index.ts', import.meta.url)
    );
    assert(source.includes("'reviews:view'"));
    assert(source.includes('listReceivedReviews'));
    assert(source.includes('listWrittenReviews'));
    assert(source.includes('listToWriteReviews'));
    assertEquals(FULL_ACCESS.includes('reviews:view'), true);
    assertEquals(READ_ONLY.includes('reviews:view'), true);
  }
);

Deno.test('respond-to-guest-review requires reviews.responses:edit', async () => {
  const source = await Deno.readTextFile(
    new URL('../respond-to-guest-review/index.ts', import.meta.url)
  );
  assert(source.includes("'reviews.responses:edit'"));
  assert(source.includes('respondToGuestReview'));
  assert(source.includes('REVIEW_RESPONSE_MAX_LEN'));
  assertEquals(FULL_ACCESS.includes('reviews.responses:edit'), true);
  assertEquals(READ_ONLY.includes('reviews.responses:edit'), false);
  assertEquals(OPERATIONS.includes('reviews.responses:edit'), true);
});
