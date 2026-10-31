/**
 * review-automation-settings — auto-review rules + per-booking pause.
 * GET: reviews:view, no plan gate (preview-open).
 * PATCH saveRules / setPaused: reviews.guests:edit + reviewAutomation (Pro+).
 */

import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { catchPlanFeatureError, requirePropertyFeature } from '../_shared/planEntitlements.ts';
import {
  resolveScopedPropertyAccess,
  verifyBookingBelongsToProperty,
} from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { logActivity, buildActorContext } from '../_shared/activityLog.ts';
import {
  DEFAULT_REVIEW_AUTOMATION_RULES,
  getReviewAutomationRules,
  parseAutomationRulesBody,
  setAutoReviewPaused,
  upsertReviewAutomationRules,
} from '../_shared/reviewAutomation.ts';
import { getReviewWindow } from '../_shared/reviewWindow.ts';

serveAuthenticated('review-automation-settings', async (req) => {
  if (req.method === 'GET') {
    let access;
    try {
      access = await resolveScopedPropertyAccess(req, 'reviews:view');
    } catch (err) {
      if (err instanceof Response) return err;
      throw err;
    }
    const rules = await getReviewAutomationRules(access.property.id);
    return jsonSuccess(req, { rules });
  }

  requireHttpMethod(req, 'PATCH');
  let access;
  try {
    access = await resolveScopedPropertyAccess(req, 'reviews.guests:edit');
    await requirePropertyFeature(access.property.id, 'reviewAutomation');
  } catch (err) {
    const planErr = catchPlanFeatureError(req, err);
    if (planErr) return planErr;
    if (err instanceof Response) return err;
    throw err;
  }

  const body = await readJsonBody(req);
  const action = typeof body.action === 'string' ? body.action : '';

  if (action === 'setPaused') {
    const bookingId = typeof body.bookingId === 'string' ? body.bookingId.trim() : '';
    if (!bookingId) return jsonError(req, 'bookingId is required', 400);
    try {
      await verifyBookingBelongsToProperty(bookingId, access.property.id);
    } catch (err) {
      if (err instanceof Response) return err;
      throw err;
    }
    const window = await getReviewWindow(bookingId);
    if (!window) return jsonError(req, 'Review window is not open', 409);
    const paused = body.paused === true;
    await setAutoReviewPaused(bookingId, paused);
    await logActivity({
      action: paused ? 'review.auto_review_paused' : 'review.auto_review_resumed',
      organizationId: access.property.organization_id,
      propertyId: access.property.id,
      actor: buildActorContext('dashboard', { propertyAccess: access }, req),
      targetId: bookingId,
      metadata: { paused },
    });
    return jsonSuccess(req, { paused });
  }

  if (action !== 'saveRules') return jsonError(req, 'Unknown action', 400);

  const parsed = parseAutomationRulesBody(body, DEFAULT_REVIEW_AUTOMATION_RULES);
  if ('error' in parsed) return jsonError(req, parsed.error, 400);

  const rules = await upsertReviewAutomationRules({
    propertyId: access.property.id,
    organizationId: access.property.organization_id,
    authorUserId: access.user.id,
    rules: parsed,
  });
  await logActivity({
    action: 'review.automation_updated',
    organizationId: access.property.organization_id,
    propertyId: access.property.id,
    actor: buildActorContext('dashboard', { propertyAccess: access }, req),
    metadata: { enabled: rules.enabled, delay_days: rules.delayDays },
  });
  return jsonSuccess(req, { rules });
});
