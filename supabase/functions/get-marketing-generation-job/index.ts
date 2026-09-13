/**
 * get-marketing-generation-job — polling endpoint for one AI generation job row.
 *
 * Trigger: GET /functions/v1/get-marketing-generation-job?property_id=<id>&jobId=<id>
 * Auth:    resolveScopedPropertyAccess(req, 'marketing:view')
 *
 * Deliberately gated on `marketing:view` with NO plan-feature argument. This is the
 * view-past-output path: an org that downgrades must still be able to watch an
 * in-flight job finish and read everything it already paid for.
 *
 * Video re-poll: when the row is a `processing` video job with an operation name and
 * `last_provider_poll_at` older than 10s (or never polled), this handler re-polls Google
 * before responding — the 10s floor honors Google's recommended minimum poll interval
 * while the client itself polls us every 3s for a responsive UI. The cron sweeper runs
 * the same finalize path independently so a closed tab still completes.
 */

import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { createServiceClient, requirePropertyPermissionAndFeature } from '../_shared/orgAuth.ts';
import { logAssetActivity } from '../_shared/assetActivity.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import {
  getMarketingGenerationJob,
  toMarketingGenerationJobDto,
  type MarketingGenerationJobRow,
} from '../_shared/marketingGenerationJobs.ts';
import { pollAndFinalizeMarketingVideoJob } from '../_shared/marketingVideoGenerationAi.ts';

const POLL_FLOOR_MS = 10_000;

function isDueForPoll(row: MarketingGenerationJobRow): boolean {
  if (row.media_type !== 'video' || row.job_status !== 'processing') return false;
  if (!row.provider_operation_name) return false;
  const lastPollAt = row.last_provider_poll_at as string | null;
  if (!lastPollAt) return true;
  return Date.now() - Date.parse(lastPollAt) > POLL_FLOOR_MS;
}

serveAuthenticated('get-marketing-generation-job', async (req) => {
  requireHttpMethod(req, 'GET');

  let propertyId: string;
  let organizationId: string;
  let actorUserId: string;
  let actorEmail: string;
  let accessKind: string;
  try {
    const scoped = await resolveScopedPropertyAccess(req, 'marketing:view');
    propertyId = scoped.property.id;
    organizationId = String(scoped.property.organization_id);
    const access = await requirePropertyPermissionAndFeature(req, propertyId, 'marketing:view');
    actorUserId = access.user.id;
    actorEmail = access.user.email;
    accessKind = access.accessKind;
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const jobId = new URL(req.url).searchParams.get('jobId')?.trim();
  if (!jobId) return jsonError(req, 'jobId is required', 400);

  const sb = createServiceClient();
  let row = await getMarketingGenerationJob(sb, jobId);
  if (!row || row.property_id !== propertyId) {
    return jsonError(req, 'Generation not found', 404);
  }

  if (isDueForPoll(row)) {
    const outcome = await pollAndFinalizeMarketingVideoJob(sb, row);
    if (outcome.job) row = outcome.job;

    if (outcome.kind === 'completed') {
      await logAssetActivity({
        req,
        user: { id: actorUserId, email: actorEmail },
        action: 'marketing.video_generated',
        propertyId,
        organizationId,
        accessKind,
        targetType: 'marketing_generation',
        targetId: jobId,
        metadata: { model: row.model, credits: outcome.creditsConsumed },
      });
    }
  }

  return jsonSuccess(req, { job: toMarketingGenerationJobDto(row) });
});
