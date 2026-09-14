/**
 * marketing-generations — gallery list + delete for AI-generated marketing assets.
 *
 * GET    ?property_id=&mediaType=&limit=&cursor=   keyset page, newest first
 * DELETE { jobId }                                 removes the object and the row
 *
 * The GET is gated on `marketing:view` only (no plan feature) so a downgraded org
 * keeps access to assets it already paid for. The DELETE needs `marketing.generate:add`.
 */

import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { createServiceClient, requirePropertyPermissionAndFeature } from '../_shared/orgAuth.ts';
import { logAssetActivity } from '../_shared/assetActivity.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import {
  MARKETING_GENERATION_JOB_COLUMNS,
  toMarketingGenerationJobDto,
} from '../_shared/marketingGenerationJobs.ts';
import { peekMarketingGenerationOverrides } from '../_shared/marketingGenerationFeatureConfig.ts';
import { removeGenerationObjects } from '../_shared/marketingGenerationStorage.ts';

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 24;

serveAuthenticated('marketing-generations', async (req) => {
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const permission = req.method === 'DELETE' ? 'marketing.generate:add' : 'marketing:view';

  let propertyId: string;
  let organizationId: string;
  let actorUserId: string;
  let actorEmail: string;
  let accessKind: string;
  try {
    const scoped = await resolveScopedPropertyAccess(req, permission);
    propertyId = scoped.property.id;
    organizationId = String(scoped.property.organization_id);
    const access = await requirePropertyPermissionAndFeature(req, propertyId, permission);
    actorUserId = access.user.id;
    actorEmail = access.user.email;
    accessKind = access.accessKind;
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const sb = createServiceClient();

  if (req.method === 'DELETE') {
    const body = (await req.json().catch(() => ({}))) as { jobId?: string };
    const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : '';
    if (!jobId) return jsonError(req, 'jobId is required', 400);

    const { data: row, error } = await sb
      .from('marketing_generation_jobs')
      .select('id, property_id, output_storage_path, media_type')
      .eq('id', jobId)
      .maybeSingle();
    if (error) return jsonError(req, error.message, 500);
    if (!row || row.property_id !== propertyId) {
      return jsonError(req, 'Generation not found', 404);
    }

    if (row.output_storage_path) {
      await removeGenerationObjects(sb, [String(row.output_storage_path)]);
    }
    const { error: deleteError } = await sb
      .from('marketing_generation_jobs')
      .delete()
      .eq('id', jobId);
    if (deleteError) return jsonError(req, deleteError.message, 500);

    await logAssetActivity({
      req,
      user: { id: actorUserId, email: actorEmail },
      action: 'marketing.generated_asset_deleted',
      propertyId,
      organizationId,
      accessKind,
      targetType: 'marketing_generation',
      targetId: jobId,
      metadata: { media_type: row.media_type },
    });

    return jsonSuccess(req, { jobId });
  }

  const url = new URL(req.url);
  const mediaType = url.searchParams.get('mediaType');
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(url.searchParams.get('limit')) || DEFAULT_LIMIT)
  );
  const cursor = url.searchParams.get('cursor')?.trim();

  let query = sb
    .from('marketing_generation_jobs')
    .select(MARKETING_GENERATION_JOB_COLUMNS)
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  if (mediaType === 'image' || mediaType === 'video') {
    query = query.eq('media_type', mediaType);
  }
  // Full keyset on (created_at, id), not created_at alone: two jobs can be inserted in
  // the same instant (the concurrency cap allows 2 in flight per property), and a
  // created_at-only cursor would silently skip the tie.
  if (cursor) {
    const [cursorCreatedAt, cursorId] = cursor.split('|');
    if (!cursorCreatedAt) return jsonError(req, 'Invalid cursor', 400);
    query = cursorId
      ? query.or(
          `created_at.lt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`
        )
      : query.lt('created_at', cursorCreatedAt);
  }

  const { data, error } = await query;
  if (error) return jsonError(req, error.message, 500);

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const overrides = await peekMarketingGenerationOverrides(propertyId);

  return jsonSuccess(req, {
    jobs: page.map(toMarketingGenerationJobDto),
    nextCursor: hasMore
      ? `${page[page.length - 1]?.created_at}|${page[page.length - 1]?.id}`
      : null,
    allowPremiumImage: overrides.allowPremiumImage,
    allowPremiumVideo: overrides.allowPremiumVideo,
  });
});
