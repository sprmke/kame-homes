/**
 * moderate-external-review — Super admin approves or rejects a pending external review.
 */

import { DatabaseService } from '../_shared/databaseService.ts';
import { invalidateAppSettingsCache } from '../_shared/appSettings.ts';
import {
  normalizeExternalReviewsDraft,
  updateExternalReviewModerationStatus,
  type ExternalReviewModerationDecision,
} from '../_shared/propertyExternalReviews.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { verifySuperAdminJwt } from '../_shared/superAdminAuth.ts';
import { logAssetActivity } from '../_shared/assetActivity.ts';

serveAuthenticated('moderate-external-review', async (req) => {
  requireHttpMethod(req, 'POST');
  const admin = await verifySuperAdminJwt(req);

  const body = await readJsonBody(req);
  const propertyId = typeof body.propertyId === 'string' ? body.propertyId.trim() : '';
  const reviewId = typeof body.reviewId === 'string' ? body.reviewId.trim() : '';
  const decisionRaw = typeof body.decision === 'string' ? body.decision.trim() : '';
  const decision: ExternalReviewModerationDecision | '' =
    decisionRaw === 'approved' || decisionRaw === 'rejected' ? decisionRaw : '';

  if (!propertyId) return jsonError(req, 'propertyId is required');
  if (!reviewId) return jsonError(req, 'reviewId is required');
  if (!decision) return jsonError(req, 'decision must be approved or rejected');

  const supabase = createServiceClient();
  const { data: row, error } = await supabase
    .from('app_settings')
    .select('external_reviews')
    .eq('property_id', propertyId)
    .maybeSingle();

  if (error) {
    console.error('[moderate-external-review]', error.message);
    throw new Error('Failed to load property settings');
  }
  if (!row) return jsonError(req, 'Property settings not found', 404);

  const existing = normalizeExternalReviewsDraft(row.external_reviews);
  let updated;
  try {
    updated = updateExternalReviewModerationStatus(existing, reviewId, decision);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid review';
    return jsonError(req, msg, 400);
  }

  await DatabaseService.updateAppSettings({ external_reviews: updated }, propertyId);
  invalidateAppSettingsCache(propertyId);

  const review = updated.find((item) => item.id === reviewId) ?? null;

  await logAssetActivity({
    req,
    user: { id: admin.id, email: admin.email },
    action: 'marketing.external_review_moderated',
    propertyId,
    accessKind: 'platform_admin',
    targetType: 'external_review',
    targetId: reviewId,
    metadata: { decision, via: 'platform_moderation' },
  });

  return jsonSuccess(req, { propertyId, review, decision });
});
