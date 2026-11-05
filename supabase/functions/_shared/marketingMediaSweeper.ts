/**
 * marketing-media-sweeper — housekeeping for the Marketing media library.
 *
 * Four independent, best-effort passes (one failing never stops the others):
 *   1. Expire `pending` reservations older than 3 h (abandoned uploads) and remove their objects.
 *   2. Purge `deleted` rows past `purge_after` (7 day restore window): objects first, then the row.
 *   3. Delete `failed` rows older than 7 days (objects were already removed when they failed).
 *   4. Orphan scan (once a day, 03:00 Manila): objects under `marketing-media/` with no row.
 *
 * Trigger: hosted pg_cron + pg_net every 30 min (see
 * supabase/migrations/20261316128920_marketing_media_sweeper_cron.sql). Reuses the marketing
 * generation cron secret, so no extra env var or Vault secret is needed.
 */

import { createServiceClient } from './orgAuth.ts';
import { MARKETING_MEDIA_BUCKET, MARKETING_MEDIA_PENDING_TTL_MS } from './marketingMediaStorage.ts';

const BATCH = 200;
const FAILED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
/** Orphans must be older than this, so an in-flight upload that has no row yet is never touched. */
const ORPHAN_MIN_AGE_HOURS = 24;
/** 03:00 Asia/Manila = 19:00 UTC; the 30 min cadence gives exactly one run in this window. */
const ORPHAN_SCAN_UTC_HOUR = 19;

type ServiceClient = ReturnType<typeof createServiceClient>;

export function pendingExpiryCutoffIso(now: Date): string {
  return new Date(now.getTime() - MARKETING_MEDIA_PENDING_TTL_MS).toISOString();
}

export function shouldRunOrphanScan(now: Date): boolean {
  return now.getUTCHours() === ORPHAN_SCAN_UTC_HOUR && now.getUTCMinutes() < 30;
}

/** Group object paths by bucket so each bucket gets one `remove` call. */
export function groupPathsByBucket(
  rows: Array<{ bucket: string; storage_path: string; poster_path: string | null }>
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const row of rows) {
    const list = out.get(row.bucket) ?? [];
    list.push(row.storage_path);
    if (row.poster_path) list.push(row.poster_path);
    out.set(row.bucket, list);
  }
  return out;
}

async function removeGrouped(sb: ServiceClient, groups: Map<string, string[]>): Promise<boolean> {
  let ok = true;
  for (const [bucket, paths] of groups) {
    const { error } = await sb.storage.from(bucket).remove(paths);
    if (error) {
      ok = false;
      console.warn('[marketing-media-sweeper] remove failed', bucket, error.message);
    }
  }
  return ok;
}

async function expirePending(sb: ServiceClient, now: Date): Promise<number> {
  const { data, error } = await sb
    .from('marketing_media_assets')
    .select('id, bucket, storage_path, poster_path')
    .eq('status', 'pending')
    .lt('created_at', pendingExpiryCutoffIso(now))
    .limit(BATCH);
  if (error || !data?.length) return 0;
  await removeGrouped(sb, groupPathsByBucket(data));
  const { error: updateError } = await sb
    .from('marketing_media_assets')
    .update({ status: 'failed' })
    .in(
      'id',
      data.map((row: { id: string }) => row.id)
    )
    .eq('status', 'pending');
  return updateError ? 0 : data.length;
}

async function purgeDeleted(sb: ServiceClient, now: Date): Promise<number> {
  const { data, error } = await sb
    .from('marketing_media_assets')
    .select('id, bucket, storage_path, poster_path')
    .eq('status', 'deleted')
    .lt('purge_after', now.toISOString())
    .limit(BATCH);
  if (error || !data?.length) return 0;
  // Only drop the row when its objects are gone; otherwise the next run retries.
  const removed = await removeGrouped(sb, groupPathsByBucket(data));
  if (!removed) return 0;
  const { error: deleteError } = await sb
    .from('marketing_media_assets')
    .delete()
    .in(
      'id',
      data.map((row: { id: string }) => row.id)
    )
    .eq('status', 'deleted');
  return deleteError ? 0 : data.length;
}

export function failedRetentionCutoffIso(now: Date): string {
  return new Date(now.getTime() - FAILED_RETENTION_MS).toISOString();
}

async function purgeFailed(sb: ServiceClient, now: Date): Promise<number> {
  const { data, error } = await sb
    .from('marketing_media_assets')
    .select('id, bucket, storage_path, poster_path')
    .eq('status', 'failed')
    .lt('created_at', failedRetentionCutoffIso(now))
    .limit(BATCH);
  if (error || !data?.length) return 0;
  // Failed rows normally have no objects; remove any stragglers before dropping the row.
  if (!(await removeGrouped(sb, groupPathsByBucket(data)))) return 0;
  const { error: deleteError } = await sb
    .from('marketing_media_assets')
    .delete()
    .in(
      'id',
      data.map((row: { id: string }) => row.id)
    )
    .eq('status', 'failed');
  return deleteError ? 0 : data.length;
}

async function removeOrphans(sb: ServiceClient): Promise<number> {
  const { data, error } = await sb.rpc('marketing_media_orphan_objects', {
    p_min_age_hours: ORPHAN_MIN_AGE_HOURS,
    p_limit: BATCH,
  });
  if (error || !Array.isArray(data) || data.length === 0) return 0;
  const names = data.map((row: { name: string } | string) =>
    typeof row === 'string' ? row : row.name
  );
  const { error: removeError } = await sb.storage.from(MARKETING_MEDIA_BUCKET).remove(names);
  if (removeError) {
    console.warn('[marketing-media-sweeper] orphan remove failed', removeError.message);
    return 0;
  }
  return names.length;
}

export async function runMarketingMediaSweeper(
  now: Date = new Date()
): Promise<Record<string, unknown>> {
  const sb = createServiceClient();
  const result: Record<string, unknown> = {
    expiredPending: 0,
    purged: 0,
    failedPurged: 0,
    orphansRemoved: 0,
  };

  const passes: Array<[string, () => Promise<number>]> = [
    ['expiredPending', () => expirePending(sb, now)],
    ['purged', () => purgeDeleted(sb, now)],
    ['failedPurged', () => purgeFailed(sb, now)],
  ];
  if (shouldRunOrphanScan(now)) passes.push(['orphansRemoved', () => removeOrphans(sb)]);

  for (const [key, run] of passes) {
    try {
      result[key] = await run();
    } catch (err) {
      console.error('[marketing-media-sweeper] pass failed', key, (err as Error).message);
    }
  }
  return result;
}
