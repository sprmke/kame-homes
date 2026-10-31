/**
 * booking-ai-review — Admin-triggered AI summary & validation for a single booking.
 *
 * Trigger: POST /functions/v1/booking-ai-review?property_id=<id>
 * Body:    { bookingId: string, force?: boolean, refresh?: boolean }
 * Auth:    resolveScopedPropertyAccess(req, 'bookings.detail.stay:edit')
 *
 * A completed job is returned as-is unless `refresh` is true and at least one
 * section's inputs have changed (or the prior job failed / got stuck). Section
 * fingerprints skip Gemini when that section is unchanged.
 * `force` only clears a live `processing` row.
 *
 * Runs **inline** on this request (not EdgeRuntime.waitUntil). Local `functions serve`
 * exposes waitUntil but drops background work after the response — that left rows stuck
 * at `processing` with 0/5 progress. Upserts after each section still stream to the UI
 * via GET polling while this POST is open.
 */

import {
  executeBookingAiReview,
  getBookingAiReviewById,
  hasPriorAiReviewResults,
  isStaleStuckProcessingRow,
  prepareBookingAiReviewJob,
  staleAiReviewSections,
  withStaleAiReviewSections,
} from '../_shared/bookingAiReviewService.ts';
import { DatabaseService } from '../_shared/databaseService.ts';
import {
  jsonSuccess,
  jsonUpgradeHook,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { catchPlanFeatureError, requirePropertyFeature } from '../_shared/planEntitlements.ts';
import {
  resolveScopedPropertyAccess,
  verifyBookingBelongsToProperty,
} from '../_shared/propertyScope.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('booking-ai-review', async (req, user) => {
  requireHttpMethod(req, 'POST');

  const limited = await rateLimitGate(req, {
    scope: 'booking-ai-review',
    identity: identityFromRequest(req, user),
    limit: 20,
    windowSec: 600,
  });
  if (limited) return limited;

  const { property, org } = await resolveScopedPropertyAccess(req, 'bookings.detail.stay:edit');
  const propertyId = property.id;

  try {
    await requirePropertyFeature(propertyId, 'aiValidations');
  } catch (err) {
    const planErr = catchPlanFeatureError(req, err);
    if (planErr) return planErr;
    throw err;
  }

  const body = await readJsonBody(req);
  const bookingId = String(body.bookingId ?? '').trim();
  const force = body.force === true;
  const refresh = body.refresh === true;
  if (!bookingId) throw new Error('bookingId is required');

  await verifyBookingBelongsToProperty(bookingId, propertyId);

  const existing = await getBookingAiReviewById(bookingId);
  if (existing?.job_status === 'completed') {
    if (!refresh) {
      return jsonSuccess(req, await withStaleAiReviewSections(existing, propertyId));
    }
    const booking = await DatabaseService.getBookingById(bookingId);
    const stale = booking
      ? await staleAiReviewSections(booking as Record<string, unknown>, propertyId, existing)
      : [];
    if (stale.length === 0) {
      return jsonSuccess(req, { ...existing, stale_sections: [] });
    }
  }
  if (existing?.job_status === 'processing' && !force && !isStaleStuckProcessingRow(existing)) {
    return jsonSuccess(req, await withStaleAiReviewSections(existing, propertyId));
  }

  const keepPriorResults =
    existing?.job_status === 'completed' ||
    existing?.job_status === 'failed' ||
    hasPriorAiReviewResults(existing);

  await prepareBookingAiReviewJob(bookingId, propertyId, user.id, { keepPriorResults });

  console.log(`[booking-ai-review] ${bookingId}: running inline`);
  const row = await executeBookingAiReview(bookingId, propertyId, user.id, org.id);
  console.log(`[booking-ai-review] ${bookingId}: finished with ${row.job_status}`);

  return jsonSuccess(req, await withStaleAiReviewSections(row, propertyId));
});
