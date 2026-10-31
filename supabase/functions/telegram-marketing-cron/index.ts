/**
 * telegram-marketing-cron — 3× daily marketing reminders via pg_cron + pg_net.
 */

import {
  runTelegramDailyReminder,
  verifyTelegramCronSecret,
} from '../_shared/telegramMarketing.ts';
import { telegramDeliveryUnavailable } from '../_shared/featureAvailability.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';

serveCronPost('telegram-marketing-cron', verifyTelegramCronSecret, async () => {
  if (await telegramDeliveryUnavailable()) return { skipped: 'feature_unavailable' };
  return runTelegramDailyReminder();
});
