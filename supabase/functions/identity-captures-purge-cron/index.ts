/**
 * identity-captures-purge-cron — retention sweep for identity captures and verdicts.
 *
 * Runs daily via hosted pg_cron + pg_net. Secret: IDENTITY_PURGE_CRON_SECRET
 * (header `x-identity-purge-cron-secret`).
 *
 * Three jobs, all idempotent:
 *   1. Mark orphaned sessions expired.
 *   2. Expire verdicts past `expires_at` (a passport that ran out is no longer verified).
 *   3. Delete capture images for sessions older than the retention window.
 *
 * One summary row per run, never one per deleted object. A sweep has no organization
 * scope, so there is no org activity row to write; `serveCronPost` records the run
 * heartbeat and Sentry covers failures.
 */

import { verifyCronSecret } from '../_shared/cronSecretGate.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';
import {
  IDENTITY_CAPTURE_BUCKET,
  identityCapturePrefix,
  type IdentitySessionRow,
} from '../_shared/identitySessionService.ts';
import { identityCaptureRetentionDays } from '../_shared/identityVerification.ts';

const BATCH = 100;

function verifyIdentityPurgeCronSecret(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'IDENTITY_PURGE_CRON_SECRET',
    headerName: 'x-identity-purge-cron-secret',
  });
}

serveCronPost('identity-captures-purge-cron', verifyIdentityPurgeCronSecret, async () => {
  const supabase = createServiceClient();
  const now = new Date();
  const cutoff = new Date(
    now.getTime() - identityCaptureRetentionDays() * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: expiredSessions } = await supabase
    .from('identity_verification_sessions')
    .update({ status: 'expired', failure_reason: 'expired' })
    .in('status', ['pending', 'in_progress', 'captured'])
    .lt('expires_at', now.toISOString())
    .select('id');

  const { data: expiredVerdicts } = await supabase
    .from('identity_verifications')
    .update({ verdict: 'expired' })
    .in('verdict', ['verified', 'partially_verified'])
    .lt('expires_at', now.toISOString())
    .select('id');

  const { data: staleSessions } = await supabase
    .from('identity_verification_sessions')
    .select('id, subject_kind, guest_user_id, owner_user_id, organization_id')
    .lt('created_at', cutoff)
    .in('status', ['completed', 'failed', 'expired'])
    .order('created_at', { ascending: true })
    .limit(BATCH);

  let filesDeleted = 0;
  let foldersScanned = 0;

  for (const row of (staleSessions ?? []) as Array<
    Pick<
      IdentitySessionRow,
      'id' | 'subject_kind' | 'guest_user_id' | 'owner_user_id' | 'organization_id'
    >
  >) {
    foldersScanned += 1;
    const prefix = identityCapturePrefix(row);
    const { data: entries, error: listError } = await supabase.storage
      .from(IDENTITY_CAPTURE_BUCKET)
      .list(prefix, { limit: 100 });
    if (listError || !entries?.length) continue;

    const paths = entries.filter((entry) => entry.name).map((entry) => `${prefix}/${entry.name}`);
    if (paths.length === 0) continue;

    const { error: removeError } = await supabase.storage
      .from(IDENTITY_CAPTURE_BUCKET)
      .remove(paths);
    if (!removeError) filesDeleted += paths.length;
  }

  return {
    expiredSessions: expiredSessions?.length ?? 0,
    expiredVerdicts: expiredVerdicts?.length ?? 0,
    foldersScanned,
    filesDeleted,
    retentionDays: identityCaptureRetentionDays(),
  };
});
