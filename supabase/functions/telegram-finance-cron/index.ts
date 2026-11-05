/**
 * telegram-finance-cron — Hourly due-date reminders via pg_cron + pg_net.
 */

import { telegramDeliveryUnavailable } from '../_shared/featureAvailability.ts';
import { runFinanceDueReminders, verifyFinanceCronSecret } from '../_shared/telegramFinance.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';

serveCronPost('telegram-finance-cron', verifyFinanceCronSecret, async () => {
  if (await telegramDeliveryUnavailable()) return { skipped: 'feature_unavailable' };
  return runFinanceDueReminders();
});
