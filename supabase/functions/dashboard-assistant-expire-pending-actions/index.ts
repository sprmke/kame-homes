/**
 * dashboard-assistant-expire-pending-actions — TTL sweep cron.
 * Trigger: hosted pg_cron + pg_net (see docs/archive/operations/scheduled-jobs-and-testing.md).
 */

import {
  runExpireDashboardAssistantPendingActions,
  verifyDashboardAssistantExpireCronSecret,
} from '../_shared/dashboardAssistantExpireCron.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';

serveCronPost(
  'dashboard-assistant-expire-pending-actions',
  verifyDashboardAssistantExpireCronSecret,
  runExpireDashboardAssistantPendingActions
);
