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

Deno.test('both Reviews endpoints share one query vocabulary', async () => {
  const shared = await Deno.readTextFile(new URL('../_shared/reviewListParams.ts', import.meta.url));
  for (const token of ['q', 'ratings', 'responded', 'hostAgain', 'sort', 'page', 'limit']) {
    assert(shared.includes(`'${token}'`), `missing ${token} param`);
  }
  // To write sorts on window close, so per-tab sort allow lists stay distinct.
  assert(shared.includes("to_write: ['closes:asc', 'closes:desc']"));
  // Filters with no column on a tab are ignored, not rejected.
  assert(shared.includes("tab === 'to_write' ? [] : parseRatings"));
  assert(shared.includes("tab === 'received' ? parseTriState"));
  assert(shared.includes("tab === 'written' ? parseTriState"));

  for (const fn of ['list-property-reviews', 'list-org-reviews']) {
    const source = await Deno.readTextFile(new URL(`../${fn}/index.ts`, import.meta.url));
    assert(source.includes('parseReviewListParams'), `${fn} parses its own params`);
    assert(source.includes('parseReviewListTab'), `${fn} parses its own tab`);
  }
});

Deno.test('list-org-reviews scopes row actions per listing', async () => {
  const source = await Deno.readTextFile(new URL('../list-org-reviews/index.ts', import.meta.url));
  assert(source.includes("'org.reviews:view'"));
  // Owners / all-listings admins hold every team permission; everyone else is resolved per row.
  assert(source.includes('canListAllProperties'));
  assert(source.includes("resolvePropertyIdsWithPermissionForOrgUser"));
  assert(source.includes("'reviews.responses:edit'"));
  assert(source.includes("'reviews.guests:edit'"));
  // The listing filter narrows the feed only — KPIs and the rollup stay org-wide.
  assert(source.includes('feedProperties'));
  assert(source.includes('getOrgReviewSummary(properties)'));

  const list = await Deno.readTextFile(new URL('../_shared/orgReviewList.ts', import.meta.url));
  assert(list.includes('canRespond: actions.respond.has(propertyId)'));
  assert(list.includes('canWrite: actions.writeGuest.has(row.property_id)'));
  assert(list.includes('host_reviews_to_write_for_properties'));
  assert(list.includes('total: count ?? 0'));
});

Deno.test('propertyReviewList pages by offset and returns a total', async () => {
  const source = await Deno.readTextFile(
    new URL('../_shared/propertyReviewList.ts', import.meta.url)
  );
  assert(source.includes("{ count: 'exact' }"));
  assert(source.includes('total: count ?? 0'));
  // PostgREST `or()` clauses are comma-separated, so separators never reach one.
  assert(source.includes('function sanitizeSearch'));
  assert(source.includes('/[,()]/g'));
  // Guest names live on the stay, so name search prefilters bookings.
  assert(source.includes('searchBookingIdsByGuestName'));
});

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
