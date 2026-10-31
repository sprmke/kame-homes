/**
 * telegram-staff-cron — Daily staff booking summary via pg_cron + pg_net.
 */

import { telegramDeliveryUnavailable } from '../_shared/featureAvailability.ts';
import { runStaffDailySummary, verifyStaffCronSecret } from '../_shared/telegramStaff.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';

serveCronPost('telegram-staff-cron', verifyStaffCronSecret, async () => {
  if (await telegramDeliveryUnavailable()) return { skipped: 'feature_unavailable' };
  return runStaffDailySummary();
});
