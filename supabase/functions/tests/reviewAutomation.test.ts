/**
 * Source-contract tests for review automation (no live DB).
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  DEFAULT_REVIEW_AUTOMATION_RULES,
  hasIssueTags,
  parseAutomationRulesBody,
} from '../_shared/reviewAutomationRules.ts';
import { allTeamPermissions } from '../_shared/propertyTeamPermissions.ts';
import { SEEDED_TEMPLATE_PERMISSIONS } from '../_shared/propertyTeamTemplates.ts';

const FULL_ACCESS = allTeamPermissions() as readonly string[];
const READ_ONLY = SEEDED_TEMPLATE_PERMISSIONS.READ_ONLY as readonly string[];

Deno.test(
  'review-automation-settings GET is preview-open; writes need guests:edit + plan',
  async () => {
    const source = await Deno.readTextFile(
      new URL('../review-automation-settings/index.ts', import.meta.url)
    );
    assert(source.includes("'reviews:view'"));
    assert(source.includes("'reviews.guests:edit'"));
    assert(source.includes("'reviewAutomation'"));
    assert(source.includes('requirePropertyFeature'));
    assert(source.includes('saveRules'));
    assert(source.includes('setPaused'));
    assertEquals(FULL_ACCESS.includes('reviews.guests:edit'), true);
    assertEquals(READ_ONLY.includes('reviews.guests:edit'), false);
  }
);

Deno.test('draft-review-with-ai never auto-posts and gates reviewAutomation', async () => {
  const source = await Deno.readTextFile(
    new URL('../draft-review-with-ai/index.ts', import.meta.url)
  );
  assert(source.includes("'reviewAutomation'"));
  assert(source.includes('draftReviewWithAi'));
  assert(!source.includes('upsertHostGuestReview'));
  assert(!source.includes('respondToGuestReview'));
  assert(source.includes("'reviews.guests:edit'"));
  assert(source.includes("'reviews.responses:edit'"));
});

Deno.test('review-lifecycle-cron runs auto-reviews after the window sweep', async () => {
  const cron = await Deno.readTextFile(
    new URL('../review-lifecycle-cron/index.ts', import.meta.url)
  );
  const runner = await Deno.readTextFile(new URL('../_shared/reviewLifecycle.ts', import.meta.url));
  assert(cron.includes('runReviewLifecycle'));
  assert(runner.includes('runAutoReviews'));
  assert(runner.includes('reviewAutomation') || runner.includes('autoReviewsSubmitted'));
});

Deno.test('hasIssueTags treats low stars and constructive tags as issues', () => {
  assertEquals(hasIssueTags(['sparkling_clean'], 5), false);
  assertEquals(hasIssueTags(['could_be_cleaner'], 5), true);
  assertEquals(hasIssueTags([], 3), true);
});

Deno.test('parseAutomationRulesBody requires three templates when enabled', () => {
  const tooFew = parseAutomationRulesBody(
    { enabled: true, templates: ['one', 'two'] },
    DEFAULT_REVIEW_AUTOMATION_RULES
  );
  assert('error' in tooFew);
  const ok = parseAutomationRulesBody(
    { enabled: true, templates: ['one', 'two', 'three'] },
    DEFAULT_REVIEW_AUTOMATION_RULES
  );
  assert(!('error' in ok));
  if (!('error' in ok)) assertEquals(ok.enabled, true);
});
