/**
 * update-booking-details — authenticated admin patches for booking detail fields.
 *
 * Replaces direct browser PostgREST writes from booking detail hooks. Validates
 * property scope, granular booking RBAC leaves, field allowlists, and applies
 * sanctioned status revert / reschedule with compare-and-swap on status.
 *
 * Trigger: POST /functions/v1/update-booking-details?property_id=
 * Auth: serveAuthenticated + resolveScopedPropertyAccess (per operation)
 */

import { buildActorContext, diffRecord, logActivity } from '../_shared/activityLog.ts';
import {
  applyBookingDetailsPatch,
  assertBookingPropertyScope,
  assertPropertyHasPermissions,
  parseBookingDetailsOperation,
  requiredPermissionsForOperation,
} from '../_shared/bookingDetailsPatch.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('update-booking-details', async (req) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);

  const bookingId = typeof body.bookingId === 'string' ? body.bookingId.trim() : '';
  if (!bookingId) {
    return jsonError(req, 'bookingId is required');
  }

  let operation;
  try {
    operation = parseBookingDetailsOperation(body.operation);
  } catch {
    return jsonError(req, 'operation is required');
  }

  let requiredPermissions;
  try {
    requiredPermissions = requiredPermissionsForOperation(operation, body);
  } catch (err) {
    return jsonError(req, (err as Error).message);
  }

  const propertyAccess = await resolveScopedPropertyAccess(req, requiredPermissions[0]!);
  assertPropertyHasPermissions(propertyAccess, requiredPermissions);

  const propertyId = propertyAccess.property.id;

  const supabase = createServiceClient();
  const { data: beforeRow, error: loadError } = await supabase
    .from('guest_submissions')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle();

  if (loadError || !beforeRow) {
    return jsonError(req, 'Booking not found', 404);
  }

  try {
    assertBookingPropertyScope(beforeRow as Record<string, unknown>, propertyId);
  } catch (err) {
    return jsonError(req, (err as Error).message, 403);
  }

  let result;
  try {
    result = await applyBookingDetailsPatch({
      bookingId,
      propertyId,
      operation,
      body,
      existingBooking: beforeRow as Record<string, unknown>,
    });
  } catch (err) {
    if (err instanceof Response) throw err;
    const message = err instanceof Error ? err.message : 'Failed to update booking';
    if (message.startsWith('STATUS_CONFLICT:')) {
      return jsonError(req, message.replace('STATUS_CONFLICT:', '').trim(), 409);
    }
    if (message === 'Booking not found') {
      return jsonError(req, message, 404);
    }
    if (message.startsWith('Failed to update booking:')) {
      console.error('[update-booking-details]', message);
      return jsonError(req, 'Failed to update booking', 500);
    }
    return jsonError(req, message, 400);
  }

  if (!result.skipped) {
    await logActivity({
      action: 'booking.details_edited',
      organizationId: propertyAccess.property.organization_id,
      propertyId,
      scope: 'property',
      actor: buildActorContext('dashboard', { propertyAccess }, req),
      targetType: 'booking',
      targetId: bookingId,
      targetLabel:
        (result.booking.primary_guest_name as string | undefined) ??
        (beforeRow.primary_guest_name as string | undefined) ??
        null,
      changes: diffRecord(
        beforeRow as Record<string, unknown>,
        result.booking,
        { include: result.changedColumns, exclude: ['updated_at'] }
      ),
      metadata: { operation },
    });
  }

  return jsonSuccess(req, {
    booking: result.booking,
    ...(result.skipped ? { skipped: true } : {}),
  });
});
