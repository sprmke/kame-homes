/**
 * query-cache-sweep-cron — nightly TTL sweep for the query_cache table.
 * Trigger: hosted pg_cron + pg_net (see docs/archive/operations/scheduled-jobs-and-testing.md).
 * Deletes expired rows so the cache table itself doesn't become the next unbounded table
 * (doc 12, Phase 12.3's own "cap the table size" rule).
 */

import { verifyCronSecret } from '../_shared/cronSecretGate.ts';
import { sweepExpiredCacheRows } from '../_shared/queryCache.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';

function verifyQueryCacheSweepCronSecret(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'QUERY_CACHE_SWEEP_CRON_SECRET',
    headerName: 'x-query-cache-sweep-cron-secret',
  });
}

serveCronPost('query-cache-sweep-cron', verifyQueryCacheSweepCronSecret, sweepExpiredCacheRows);
