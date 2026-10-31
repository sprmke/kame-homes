/**
 * transition-booking — Admin endpoint to advance a booking through the workflow.
 */

import { isBookingStatus } from '../_shared/statusMachine.ts';
import { buildActorContext } from '../_shared/activityLog.ts';
import { WorkflowOrchestrator } from '../_shared/workflowOrchestrator.ts';
import { jsonResponse, readJsonBody, requireHttpMethod } from '../_shared/httpResponse.ts';
import { withIdempotency } from '../_shared/idempotency.ts';
import {
  resolveScopedPropertyAccess,
  verifyBookingBelongsToProperty,
} from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

// `withIdempotency`: an `Idempotency-Key` header (sent by the PWA offline outbox
// on replay) makes this transition run at most once.
serveAuthenticated(
  'transition-booking',
  withIdempotency(async (req) => {
    requireHttpMethod(req, 'POST');
    const propertyAccess = await resolveScopedPropertyAccess(req, 'bookings.detail.workflow:edit');
    const { property } = propertyAccess;
    const propertyId = property.id;
    const body = await readJsonBody(req);
    const { bookingId, toStatus, payload = {}, devControls = {}, manual = true } = body;

    if (!bookingId) throw new Error('bookingId is required');
    if (!toStatus) throw new Error('toStatus is required');
    if (!isBookingStatus(toStatus)) {
      throw new Error(`Invalid toStatus: "${toStatus}"`);
    }

    await verifyBookingBelongsToProperty(String(bookingId), propertyId);

    console.log(
      `[transition-booking] ${bookingId} → ${toStatus} (manual=${manual}, property=${propertyId})`
    );

    const result = await WorkflowOrchestrator.transition(
      String(bookingId),
      toStatus,
      payload,
      devControls,
      manual,
      buildActorContext('dashboard', { propertyAccess }, req)
    );

    return jsonResponse(req, { success: true, data: result });
  })
);
