/**
 * meta-inbox-webhook-healthcheck — verifies and re-subscribes Meta webhooks.
 * Trigger: hosted pg_cron + pg_net; safe to run manually with the cron secret.
 */

import {
  runMetaInboxWebhookHealthcheck,
  verifyMetaInboxWebhookHealthcheckCronSecret,
} from '../_shared/metaInboxHealthcheckCron.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';

serveCronPost(
  'meta-inbox-webhook-healthcheck',
  verifyMetaInboxWebhookHealthcheckCronSecret,
  runMetaInboxWebhookHealthcheck
);
