/**
 * send-parking-reminders — Phase 7 pre-arrival nudge cron. Trigger: hosted pg_cron + pg_net
 * (see docs/archive/operations/scheduled-jobs-and-testing.md), mirrors expire-parking-broadcasts.
 */

import {
  runParkingReminderSweep,
  verifyParkingReminderCronSecret,
} from '../_shared/parkingReminderCron.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';

serveCronPost('send-parking-reminders', verifyParkingReminderCronSecret, async () => {
  return await runParkingReminderSweep();
});
