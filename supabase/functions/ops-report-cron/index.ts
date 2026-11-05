/**
 * ops-report-cron — weekly operations report, Monday 08:00 Manila.
 * Secret: OPS_REPORT_CRON_SECRET / x-ops-report-cron-secret.
 * Plan: docs/workflow/in-progress/weekly-ops-report.md
 */
import { verifyCronSecret } from '../_shared/cronSecretGate.ts';
import { runWeeklyOpsReport } from '../_shared/opsReportRunner.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';

serveCronPost(
  'ops-report-cron',
  (req) =>
    verifyCronSecret(req, {
      envKey: 'OPS_REPORT_CRON_SECRET',
      headerName: 'x-ops-report-cron-secret',
    }),
  () => runWeeklyOpsReport()
);
