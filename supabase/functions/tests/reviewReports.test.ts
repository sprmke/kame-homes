/**
 * Source-contract tests for review report + super-admin moderation.
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { allTeamPermissions } from '../_shared/propertyTeamPermissions.ts';
import { SEEDED_TEMPLATE_PERMISSIONS } from '../_shared/propertyTeamTemplates.ts';

const READ_ONLY = SEEDED_TEMPLATE_PERMISSIONS.READ_ONLY as readonly string[];
const FULL_ACCESS = allTeamPermissions() as readonly string[];

Deno.test('report-review caps 2 pending host reports and requires 30+ chars', async () => {
  const source = await Deno.readTextFile(new URL('../report-review/index.ts', import.meta.url));
  assert(source.includes("'reviews.responses:edit'"));
  assert(source.includes('>= 2'));
  assert(source.includes('30 characters'));
  assert(source.includes("status !== 'published'"));
  assert(source.includes("reporterSide: 'guest'"));
  assert(source.includes('guestOwnsHostReview'));
  assertEquals(FULL_ACCESS.includes('reviews.responses:edit'), true);
  assertEquals(READ_ONLY.includes('reviews.responses:edit'), false);
});

Deno.test('moderate-review-report removes published reviews on uphold', async () => {
  const source = await Deno.readTextFile(
    new URL('../moderate-review-report/index.ts', import.meta.url)
  );
  assert(source.includes('verifySuperAdminJwt'));
  assert(source.includes("status: 'removed'"));
  assert(source.includes('sendReviewReportDecisionEmail'));
  assert(source.includes("'review.removed'"));
  assert(source.includes('property_review_summary') === false);
});

Deno.test(
  'moderate-review-report claims the report before acting and emails the real author',
  async () => {
    const source = await Deno.readTextFile(
      new URL('../moderate-review-report/index.ts', import.meta.url)
    );
    const claimAt = source.indexOf(".eq('status', 'pending')");
    const removeAt = source.indexOf("status: 'removed'");
    assert(claimAt > 0 && removeAt > claimAt, 'pending claim must run before the removal');
    assert(source.includes('Review removed by another report'));
    assert(source.includes('author_user_id'));
  }
);

Deno.test('report-review: hosts can only report guest reviews', async () => {
  const source = await Deno.readTextFile(new URL('../report-review/index.ts', import.meta.url));
  assert(
    source.includes(
      "if (reviewKind !== 'guest_review') return jsonError(req, 'Review not found', 404);"
    )
  );
});
