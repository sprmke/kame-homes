/**
 * telegram-admin-cron — Hourly via pg_cron + pg_net.
 */

import { runAdminHourlyAlerts, verifyAdminCronSecret } from '../_shared/telegramAdmin.ts';
import { telegramDeliveryUnavailable } from '../_shared/featureAvailability.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';

serveCronPost('telegram-admin-cron', verifyAdminCronSecret, async () => {
  if (await telegramDeliveryUnavailable()) return { skipped: 'feature_unavailable' };
  return runAdminHourlyAlerts();
});
