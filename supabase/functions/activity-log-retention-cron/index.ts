/**
 * activity-log-retention-cron — Org Activity & Audit Log, Phase 6 retention.
 *
 * Plan:     docs/workflow/in-progress/org-activity-audit-log.md  (Phase 6)
 * Schedule: hosted pg_cron + pg_net, NOT config.toml (see scheduled-jobs-and-testing.md).
 *           Optional header X-Activity-Log-Retention-Cron-Secret when
 *           ACTIVITY_LOG_RETENTION_CRON_SECRET is set.
 *
 * activity_log is append-only — a BEFORE UPDATE OR DELETE trigger blocks every
 * DELETE (service_role included) unless `activity_log.allow_purge = 'on'` is set
 * in that session. So the purge runs through the SECURITY DEFINER RPC
 * `public.purge_activity_log(months, max_rows)`, which sets that GUC, deletes in
 * bounded batches oldest-first, and returns the row count. The window comes from
 * `platform_settings.activity_log_retention_months` (default 24, floor 6 so a
 * misconfig can never drop recent history). Runs monthly.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';
import { verifyCronSecret } from '../_shared/cronSecretGate.ts';

const DEFAULT_RETENTION_MONTHS = 24;
const MIN_RETENTION_MONTHS = 6;
const MAX_ROWS_PER_RUN = 200_000;

function cronSecretOk(req: Request): boolean {
  // Fail-closed in production when the secret is unset (shared gate) — never burn AI credits or
  // run destructive jobs for an anonymous caller.
  return verifyCronSecret(req, { envKey: 'ACTIVITY_LOG_RETENTION_CRON_SECRET', headerName: 'x-activity-log-retention-cron-secret' });
}

serveCronPost('activity-log-retention-cron', cronSecretOk, async () => {
  const supabase = createServiceClient();

  let months = DEFAULT_RETENTION_MONTHS;
  const { data: settings } = await supabase
    .from('platform_settings')
    .select('activity_log_retention_months')
    .eq('id', 1)
    .maybeSingle();
  const configured = (settings as { activity_log_retention_months?: number | null } | null)
    ?.activity_log_retention_months;
  if (typeof configured === 'number' && Number.isFinite(configured)) {
    months = Math.max(MIN_RETENTION_MONTHS, Math.floor(configured));
  }

  const { data, error } = await supabase.rpc('purge_activity_log', {
    p_retention_months: months,
    p_max_rows: MAX_ROWS_PER_RUN,
  });
  if (error) throw new Error(error.message);

  const deleted = typeof data === 'number' ? data : 0;
  return { retentionMonths: months, deleted, capped: deleted >= MAX_ROWS_PER_RUN };
});
