/**
 * report-review — host or guest reports a published review (max 2 open per side).
 * Host path: reviews.responses:edit. Guest path: owner of a published host_guest_review.
 */

import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { normalizeReviewText, validateReviewText } from '../_shared/reviewContentPolicy.ts';
import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import { logGuestActivity } from '../_shared/guestActivity.ts';
import { guestOwnsHostReview } from '../_shared/guestMyReviews.ts';
import { capturePostHogEvent } from '../_shared/posthog.ts';

const REASONS = new Set([
  'not_a_real_stay',
  'incentive_or_extortion',
  'retaliation',
  'discriminatory',
  'harassment_or_threat',
  'private_information',
  'irrelevant',
  'other',
]);

serveAuthenticated('report-review', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);

  const reviewKind = body.reviewKind === 'host_guest_review' ? 'host_guest_review' : 'guest_review';
  const reviewId = typeof body.reviewId === 'string' ? body.reviewId.trim() : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reviewId) return jsonError(req, 'reviewId is required', 400);
  if (!REASONS.has(reason)) return jsonError(req, 'Invalid reason', 400);

  const details = normalizeReviewText(typeof body.details === 'string' ? body.details : '');
  const detailsErr = validateReviewText(details, {
    maxLen: 2000,
    fieldLabel: 'Details',
    allowContactInfo: true,
  });
  if (detailsErr) return jsonError(req, detailsErr, 400);
  if (!details || details.length < 30) {
    return jsonError(req, 'Add at least 30 characters of detail', 400);
  }

  let access = null;
  try {
    access = await resolveScopedPropertyAccess(req, 'reviews.responses:edit');
  } catch (err) {
    if (
      !(err instanceof Response) ||
      (err.status !== 400 && err.status !== 401 && err.status !== 403)
    ) {
      if (err instanceof Response) return err;
      throw err;
    }
  }

  const supabase = createServiceClient();

  if (access) {
    // Hosts report what guests wrote about them. A team's own review of a guest
    // is edited or left alone, not reported.
    if (reviewKind !== 'guest_review') return jsonError(req, 'Review not found', 404);
    const { data: review } = await supabase
      .from('guest_reviews')
      .select('id, property_id, organization_id, status')
      .eq('id', reviewId)
      .maybeSingle();
    if (!review || review.property_id !== access.property.id) {
      return jsonError(req, 'Review not found', 404);
    }
    if (review.status !== 'published') {
      return jsonError(req, 'Only published reviews can be reported', 409);
    }
    const inserted = await insertReport({
      supabase,
      reviewKind,
      reviewId,
      reporterUserId: access.user.id,
      reporterSide: 'host',
      reason,
      details,
    });
    if (inserted === 'cap') return jsonError(req, 'Already reported', 409);
    if (inserted === 'error') return jsonError(req, 'Could not submit report', 500);

    await logActivity({
      action: 'review.reported',
      organizationId: access.property.organization_id,
      propertyId: access.property.id,
      actor: buildActorContext('dashboard', { propertyAccess: access }, req),
      targetId: reviewId,
      metadata: { review_kind: reviewKind, reason },
    });
    await capturePostHogEvent('review_reported', {
      logPrefix: 'report-review',
      request: req,
      properties: { property_id: access.property.id, review_kind: reviewKind, reason },
    });
    return jsonSuccess(req, { reported: true });
  }

  if (reviewKind !== 'host_guest_review') {
    return jsonError(req, 'Review not found', 404);
  }
  const owned = await guestOwnsHostReview(user, reviewId);
  if (!owned.ok) return jsonError(req, 'Review not found', 404);
  const { data: review } = await supabase
    .from('host_guest_reviews')
    .select('id, status')
    .eq('id', reviewId)
    .maybeSingle();
  if (!review || review.status !== 'published') {
    return jsonError(req, 'Only published reviews can be reported', 409);
  }

  const inserted = await insertReport({
    supabase,
    reviewKind,
    reviewId,
    reporterUserId: user.id,
    reporterSide: 'guest',
    reason,
    details,
  });
  if (inserted === 'cap') return jsonError(req, 'Already reported', 409);
  if (inserted === 'error') return jsonError(req, 'Could not submit report', 500);

  await logGuestActivity({
    req,
    action: 'review.reported',
    propertyId: owned.propertyId,
    guest: { email: user.email },
    targetId: reviewId,
    metadata: { review_kind: reviewKind, reason, side: 'guest' },
  });
  await capturePostHogEvent('review_reported', {
    logPrefix: 'report-review',
    request: req,
    properties: { property_id: owned.propertyId, review_kind: reviewKind, reason, side: 'guest' },
  });
  return jsonSuccess(req, { reported: true });
});

async function insertReport(input: {
  supabase: ReturnType<typeof createServiceClient>;
  reviewKind: 'guest_review' | 'host_guest_review';
  reviewId: string;
  reporterUserId: string;
  reporterSide: 'host' | 'guest';
  reason: string;
  details: string;
}): Promise<'ok' | 'cap' | 'error'> {
  const { count } = await input.supabase
    .from('review_reports')
    .select('id', { count: 'exact', head: true })
    .eq('review_kind', input.reviewKind)
    .eq('review_id', input.reviewId)
    .eq('reporter_side', input.reporterSide)
    .eq('status', 'pending');
  if ((count ?? 0) >= 2) return 'cap';
  const { error } = await input.supabase.from('review_reports').insert({
    review_kind: input.reviewKind,
    review_id: input.reviewId,
    reporter_user_id: input.reporterUserId,
    reporter_side: input.reporterSide,
    reason: input.reason,
    details: input.details,
  });
  return error ? 'error' : 'ok';
}
