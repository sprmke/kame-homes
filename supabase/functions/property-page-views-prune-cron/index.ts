/**
 * property-page-views-prune-cron — Host Analytics Phase 2b follow-up.
 * Plan: docs/workflow/in-progress/host-analytics-module.md (Phase 2b)
 * Schedule: hosted pg_cron + pg_net, NOT config.toml. Optional header
 * X-Property-Page-Views-Prune-Cron-Secret when PROPERTY_PAGE_VIEWS_PRUNE_CRON_SECRET is set.
 *
 * property_page_views is high-volume append-only and only ever queried as a grouped range scan
 * (never a single row lookup) — safe to delete rows past the retention window without affecting
 * any already-computed AnalyticsBundle (those numbers are point-in-time, not recomputed from
 * history). Runs monthly; deletes in bounded batches so a large backlog never holds one
 * long-running DELETE.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';
import { verifyCronSecret } from '../_shared/cronSecretGate.ts';

const RETENTION_DAYS = 180;
const BATCH_SIZE = 5000;
const MAX_BATCHES = 20; // caps a single run at 100k rows; next month's run continues from there.

function cronSecretOk(req: Request): boolean {
  // Fail-closed in production when the secret is unset (shared gate) — never burn AI credits or
  // run destructive jobs for an anonymous caller.
  return verifyCronSecret(req, { envKey: 'PROPERTY_PAGE_VIEWS_PRUNE_CRON_SECRET', headerName: 'x-property-page-views-prune-cron-secret' });
}

serveCronPost('property-page-views-prune-cron', cronSecretOk, async () => {
  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();

  let totalDeleted = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const { data: ids, error: selectError } = await supabase
      .from('property_page_views')
      .select('id')
      .lt('viewed_at', cutoff)
      .limit(BATCH_SIZE);
    if (selectError) throw new Error(selectError.message);
    if (!ids || ids.length === 0) break;

    const { error: deleteError } = await supabase
      .from('property_page_views')
      .delete()
      .in(
        'id',
        ids.map((row: { id: string }) => row.id)
      );
    if (deleteError) throw new Error(deleteError.message);

    totalDeleted += ids.length;
    if (ids.length < BATCH_SIZE) break;
  }

  return { retentionDays: RETENTION_DAYS, deleted: totalDeleted };
});
