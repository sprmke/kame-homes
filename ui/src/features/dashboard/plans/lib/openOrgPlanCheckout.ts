import { markOrgPlanCheckoutSession } from '@/features/dashboard/plans/lib/orgPlanCheckoutSession';

import { captureAppEvent } from '@/lib/posthog/capture';

/**
 * Redirect to PayMongo Hosted Checkout (same tab). PayMongo returns the host to
 * `success_url` / `cancel_url` configured server-side when the session is created.
 */
export function openOrgPlanCheckout(params: {
  orgId: string;
  transactionId: string;
  checkoutUrl: string;
  previousPlanId: string | null;
  targetPlanId: string;
}): void {
  markOrgPlanCheckoutSession({
    orgId: params.orgId,
    transactionId: params.transactionId,
    startedAt: Date.now(),
    previousPlanId: params.previousPlanId,
    targetPlanId: params.targetPlanId,
  });

  captureAppEvent('org_plan_checkout_started', {
    previous_plan_id: params.previousPlanId ?? 'none',
    target_plan_id: params.targetPlanId,
  });
  window.location.assign(params.checkoutUrl);
}
