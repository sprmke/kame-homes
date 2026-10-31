/**
 * platform-billing-cron — renewal links, past-due, suspension sweep.
 */

import { runPlatformBillingCycle } from '../_shared/subscriptionOrchestrator.ts';
import { verifyCronSecret } from '../_shared/cronSecretGate.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';

function verifyPlatformBillingCronSecret(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'PLATFORM_BILLING_CRON_SECRET',
    headerName: 'x-platform-billing-cron-secret',
  });
}

serveCronPost('platform-billing-cron', verifyPlatformBillingCronSecret, runPlatformBillingCycle);
