/**
 * validate-booking-receipts — Admin one-shot AI backfill for payment receipts
 * and guest valid ID.
 *
 * When a booking already has receipt image URLs but no persisted AI verdict
 * (e.g. legacy rows before validation shipped), download each image from
 * Storage and run Gemini once. Skips COMPLETED / CANCELLED bookings.
 *
 * Trigger: POST /functions/v1/validate-booking-receipts
 * Body:    { bookingId: string }
 * Auth:    verifyAdminJwt(req)
 */

import { syncPricingReviewBalanceReceipt } from '../_shared/bookingAiReviewService.ts';
import { DatabaseService } from '../_shared/databaseService.ts';
import {
  backfillMissingReceiptAiVerdicts,
  dbPatchFromReceiptBackfillItems,
} from '../_shared/receiptValidationService.ts';
import { jsonSuccess, readJsonBody, requireHttpMethod } from '../_shared/httpResponse.ts';
import { catchPlanFeatureError, requirePropertyFeature } from '../_shared/planEntitlements.ts';
import {
  resolveScopedPropertyAccess,
  verifyBookingBelongsToProperty,
} from '../_shared/propertyScope.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('validate-booking-receipts', async (req, authUser) => {
  requireHttpMethod(req, 'POST');

  const limited = await rateLimitGate(req, {
    scope: 'validate-booking-receipts',
    identity: identityFromRequest(req, authUser),
    limit: 20,
    windowSec: 600,
  });
  if (limited) return limited;

  const { user, property, org } = await resolveScopedPropertyAccess(
    req,
    'bookings.detail.pricing:edit'
  );
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
  if (!bookingId) throw new Error('bookingId is required');

  await verifyBookingBelongsToProperty(bookingId, propertyId);

  const booking = await DatabaseService.getBookingById(bookingId);
  if (!booking) throw new Error(`Booking not found: ${bookingId}`);

  const { validated, errors } = await backfillMissingReceiptAiVerdicts(
    booking as Record<string, unknown>,
    { organizationId: org.id, propertyId, actorUserId: user.id, actorType: 'staff' }
  );

  if (validated.length > 0) {
    await DatabaseService.setWorkflowFields(bookingId, dbPatchFromReceiptBackfillItems(validated));
    console.log(
      `[validate-booking-receipts] ${bookingId}: validated ${validated.length} receipt(s)`
    );
    if (validated.some((item) => item.kind === 'balance')) {
      try {
        await syncPricingReviewBalanceReceipt(bookingId);
      } catch (aiReviewErr) {
        console.error(
          '[validate-booking-receipts] AI Summary Pricing sync failed (non-fatal):',
          aiReviewErr
        );
      }
    }
  }

  if (errors.length > 0) {
    console.warn(
      `[validate-booking-receipts] ${bookingId}: AI model errors for ${errors.length} receipt(s)`,
      errors
    );
  }

  return jsonSuccess(req, { validated, errors });
});
