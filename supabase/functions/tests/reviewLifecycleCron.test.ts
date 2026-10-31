/**
 * Source-contract tests for review-lifecycle-cron (no live DB / Resend).
 */

import { assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';

Deno.test('review-lifecycle-cron uses the dedicated secret gate and lifecycle runner', async () => {
  const source = await Deno.readTextFile(
    new URL('../review-lifecycle-cron/index.ts', import.meta.url)
  );
  assert(source.includes("envKey: 'REVIEW_LIFECYCLE_CRON_SECRET'"));
  assert(source.includes("headerName: 'x-review-lifecycle-cron-secret'"));
  assert(source.includes('runReviewLifecycle'));
  assert(source.includes("'system.cron_run'"));
});

Deno.test(
  'reviewLifecycle marks request/reminder once and force-publishes expired windows',
  async () => {
    const source = await Deno.readTextFile(
      new URL('../_shared/reviewLifecycle.ts', import.meta.url)
    );
    assert(source.includes('guest_request_sent_at'));
    assert(source.includes('guest_reminder_sent_at'));
    assert(source.includes('host_reminder_notified_at'));
    assert(source.includes('publishExpired'));
    assert(source.includes("closed_reason: 'cancelled'"));
    assert(source.includes('emailReviewRequest'));
    assert(source.includes('emailReviewReminder'));
    assert(source.includes('computeReviewWindow'));
    assert(source.includes(".is('parking_id', null)"));
  }
);
