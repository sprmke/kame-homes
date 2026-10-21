/**
 * review-lifecycle-cron — hourly sweep for the 14-day double-blind review window.
 * Opens missing windows, sends request/reminder emails once, host review_due
 * bells once, force-publishes expired windows, then runs auto-reviews.
 *
 * Activity: one `system.cron_run` row per organization where something
 * happened this run, carrying that organization's counts only.
 */

import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import { verifyCronSecret } from '../_shared/cronSecretGate.ts';
import { runReviewLifecycle } from '../_shared/reviewLifecycle.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';

function verifyReviewLifecycleCronSecret(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'REVIEW_LIFECYCLE_CRON_SECRET',
    headerName: 'x-review-lifecycle-cron-secret',
  });
}

serveCronPost('review-lifecycle-cron', verifyReviewLifecycleCronSecret, async () => {
  const { byOrganization, ...totals } = await runReviewLifecycle();
  for (const [organizationId, counts] of Object.entries(byOrganization)) {
    const count = Object.values(counts).reduce((sum, n) => sum + n, 0);
    await logActivity({
      action: 'system.cron_run',
      organizationId,
      actor: buildActorContext('cron', { cron: 'review-lifecycle-cron' }),
      metadata: {
        message: 'Review lifecycle cron finished',
        count,
        ...counts,
      },
    });
  }
  return { ...totals, organizations: Object.keys(byOrganization).length };
});
