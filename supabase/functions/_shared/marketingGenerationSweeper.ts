/**
 * marketing-generation-sweeper — the cron half of the video async lifecycle.
 *
 * Five passes, run in order, each independent and best-effort (one pass's failure
 * must never stop the others). See docs/workflow's Phase 2 plan §3.E / §4.
 */

import { logActivity, buildActorContext } from './activityLog.ts';
import { verifyCronSecret } from './cronSecretGate.ts';
import { createServiceClient } from './orgAuth.ts';
import { recordAiUsage } from './aiUsageService.ts';
import {
  billingRepairStaleClaimCutoffIso,
  claimMarketingGenerationJobBilling,
  expireStaleMarketingGenerationJobs,
  listMarketingGenerationJobsNeedingBillingRepair,
  listMarketingVideoJobsDueForPoll,
  listStaleGenerationReferences,
  deleteGenerationReferences,
  reclaimStaleFinalizingJobs,
  recordMarketingGenerationJobUsage,
} from './marketingGenerationJobs.ts';
import { removeGenerationObjects } from './marketingGenerationStorage.ts';
import { pollAndFinalizeMarketingVideoJob } from './marketingVideoGenerationAi.ts';

const CRON_ACTOR = 'marketing-generation-sweeper';

export function verifyMarketingGenerationCronSecret(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'MARKETING_GENERATION_CRON_SECRET',
    headerName: 'x-marketing-generation-cron-secret',
  });
}

async function runFinalizePass(sb: ReturnType<typeof createServiceClient>): Promise<number> {
  const due = await listMarketingVideoJobsDueForPoll(sb);
  let finalized = 0;

  for (const job of due) {
    try {
      const outcome = await pollAndFinalizeMarketingVideoJob(sb, job);
      if (outcome.kind === 'completed') {
        finalized += 1;
        await logActivity({
          action: 'marketing.video_generated',
          organizationId: String(job.organization_id),
          propertyId: String(job.property_id),
          actor: buildActorContext('cron', { cron: CRON_ACTOR }),
          targetType: 'marketing_generation',
          targetId: String(job.id),
          metadata: { model: job.model, credits: outcome.creditsConsumed },
        });
      }
    } catch (err) {
      // One job's failure (a transient Google 5xx, a storage hiccup) must not stop the
      // rest of the batch — it stays `processing` and is retried on the next tick.
      console.error(
        '[marketing-generation-sweeper] finalize pass failed for job',
        job.id,
        (err as Error).message
      );
    }
  }

  return finalized;
}

async function runBillingRepairPass(sb: ReturnType<typeof createServiceClient>): Promise<number> {
  const rows = await listMarketingGenerationJobsNeedingBillingRepair(sb);
  const staleClaimBeforeIso = billingRepairStaleClaimCutoffIso();
  let repaired = 0;

  for (const row of rows) {
    try {
      // Re-claim (or claim for the first time) before billing — same CAS discipline as
      // the main flow. A row here either was never claimed, or its claim is already
      // older than the cutoff this list query used, so this always succeeds unless a
      // concurrent sweeper run (or a very slow original request) claimed it first.
      const claimed = await claimMarketingGenerationJobBilling(sb, String(row.id), {
        staleClaimBeforeIso,
      });
      if (!claimed) continue;

      const isVideo = row.media_type === 'video';
      const usage = await recordAiUsage({
        organizationId: String(row.organization_id),
        propertyId: String(row.property_id),
        feature: isVideo ? 'marketing_video_generate' : 'marketing_image_generate',
        provider: 'gemini',
        model: String(row.model),
        estimatedCostUsd: Number(row.estimated_cost_usd ?? 0),
        durationSeconds: isVideo ? Number(row.duration_seconds ?? 0) : undefined,
        actorUserId: (row.triggered_by as string | null) ?? null,
        actorType: 'staff',
      });
      await recordMarketingGenerationJobUsage(sb, String(row.id), {
        creditsConsumed: usage.creditsConsumed,
        usageEventId: usage.usageEventId,
      });
      repaired += 1;
    } catch (err) {
      console.error(
        '[marketing-generation-sweeper] billing repair failed for job',
        row.id,
        (err as Error).message
      );
    }
  }

  return repaired;
}

async function runReferencePrunePass(sb: ReturnType<typeof createServiceClient>): Promise<number> {
  const stale = await listStaleGenerationReferences(sb);
  if (stale.length === 0) return 0;

  await removeGenerationObjects(
    sb,
    stale.map((reference) => reference.storage_path)
  );
  await deleteGenerationReferences(
    sb,
    stale.map((reference) => reference.id)
  );
  return stale.length;
}

export async function runMarketingGenerationSweeper(): Promise<Record<string, unknown>> {
  const sb = createServiceClient();

  const reclaimed = await reclaimStaleFinalizingJobs(sb).catch((err) => {
    console.error('[marketing-generation-sweeper] reclaim pass failed:', err.message);
    return 0;
  });

  const finalized = await runFinalizePass(sb);

  const expired = await expireStaleMarketingGenerationJobs(sb).catch((err) => {
    console.error('[marketing-generation-sweeper] expire pass failed:', err.message);
    return 0;
  });

  const repaired = await runBillingRepairPass(sb);
  const pruned = await runReferencePrunePass(sb).catch((err) => {
    console.error('[marketing-generation-sweeper] reference prune failed:', err.message);
    return 0;
  });

  return { reclaimed, finalized, expired, repaired, pruned };
}
