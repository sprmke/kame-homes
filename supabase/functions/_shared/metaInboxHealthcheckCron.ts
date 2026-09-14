/**
 * Periodic verification of Meta page webhook subscriptions.
 */

import {
  listConnectedFacebookMetaPagesForHealthcheck,
  reconcileMetaConnectionWebhook,
} from './metaInboxWebhookHealth.ts';
import { verifyCronSecret } from './cronSecretGate.ts';

export function verifyMetaInboxWebhookHealthcheckCronSecret(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'META_INBOX_WEBHOOK_HEALTHCHECK_CRON_SECRET',
    headerName: 'x-meta-inbox-webhook-healthcheck-cron-secret',
  });
}

export async function runMetaInboxWebhookHealthcheck(): Promise<Record<string, unknown>> {
  const connections = await listConnectedFacebookMetaPagesForHealthcheck();
  let verified = 0;
  let resubscribed = 0;
  let failed = 0;

  for (const connection of connections) {
    const result = await reconcileMetaConnectionWebhook(connection);
    if (result.verified) {
      verified += 1;
      if (result.resubscribed) {
        resubscribed += 1;
      }
      continue;
    }
    failed += 1;
  }

  return {
    scanned: connections.length,
    verified,
    resubscribed,
    failed,
  };
}
