/**
 * expire-parking-broadcasts — TTL sweep cron: broadcast batches (Phase 2) and, since Phase 3,
 * payment windows too — same schedule/endpoint, no separate pg_cron entry needed for the latter.
 * Trigger: hosted pg_cron + pg_net (see docs/archive/operations/scheduled-jobs-and-testing.md).
 */

import {
  runExpireParkingBroadcasts,
  runExpireParkingPayments,
  verifyParkingBroadcastExpireCronSecret,
} from '../_shared/parkingBroadcastExpireCron.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';

serveCronPost('expire-parking-broadcasts', verifyParkingBroadcastExpireCronSecret, async () => {
  const [broadcasts, payments] = await Promise.all([
    runExpireParkingBroadcasts(),
    runExpireParkingPayments(),
  ]);
  return { broadcasts, payments };
});
