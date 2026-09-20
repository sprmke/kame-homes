/**
 * send-property-custom-template-email — Admin manual send of a saved custom
 * template to a booking's guest.
 *
 * POST { bookingId: string, templateKey: string }
 *
 * Not tied to booking status or an automation toggle — the operator picks the
 * booking and template, and the send happens immediately (subject to the
 * guest email suppression list, same as workflow emails).
 */

import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import { sendPropertyCustomTemplateEmail } from '../_shared/emailService.ts';
import {
  jsonError,
  jsonResponse,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import {
  resolveScopedPropertyAccess,
  verifyBookingBelongsToProperty,
} from '../_shared/propertyScope.ts';
import { isCustomTemplateKey, resolveCustomTemplateRow } from '../_shared/propertyTemplates.ts';
import { DatabaseService } from '../_shared/databaseService.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('send-property-custom-template-email', async (req) => {
  requireHttpMethod(req, 'POST');
  const propertyAccess = await resolveScopedPropertyAccess(req, 'bookings.detail.workflow:edit');
  const propertyId = propertyAccess.property.id;
  const body = await readJsonBody(req);
  const bookingId = body?.bookingId;
  const templateKey = body?.templateKey;

  if (!bookingId || typeof bookingId !== 'string') {
    return jsonError(req, 'bookingId (string) is required');
  }
  if (!templateKey || typeof templateKey !== 'string' || !isCustomTemplateKey(templateKey)) {
    return jsonError(req, 'templateKey must be a custom template key');
  }

  await verifyBookingBelongsToProperty(bookingId, propertyId);

  const template = await resolveCustomTemplateRow(propertyId, templateKey);
  if (!template) {
    return jsonError(req, 'Custom template not found or has no content', 404);
  }

  const booking = await DatabaseService.getBookingById(bookingId);
  if (!booking) {
    return jsonError(req, 'Booking not found', 404);
  }
  if (!booking.guest_email) {
    return jsonError(req, 'Booking has no guest email', 409);
  }

  const result = await sendPropertyCustomTemplateEmail(
    booking,
    templateKey,
    template.name,
    template.content
  );

  if (result && 'skipped' in result && result.skipped) {
    return jsonError(req, 'Guest email is suppressed — cannot send', 409);
  }

  await logActivity({
    action: 'booking.custom_template_sent',
    organizationId: propertyAccess.property.organization_id,
    propertyId,
    scope: 'property',
    actor: buildActorContext('dashboard', { propertyAccess }, req),
    targetType: 'booking',
    targetId: bookingId,
    targetLabel: (booking.primary_guest_name as string | undefined) ?? null,
    metadata: { template_key: templateKey, template_name: template.name },
  });

  return jsonResponse(req, { success: true, bookingId, templateKey });
});
