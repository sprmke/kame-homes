/**
 * get-booking-ai-assistant-audit — read-only "Actions taken by AI assistant" audit trail for a
 * single booking. Powers the booking-detail viewer (docs/workflow/planned/ai-dashboard-assistant.md
 * §6 / phase 6).
 */

import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  resolveScopedPropertyAccess,
  verifyBookingBelongsToProperty,
} from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('get-booking-ai-assistant-audit', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const url = new URL(req.url);
  const bookingId = url.searchParams.get('booking_id')?.trim();
  if (!bookingId) {
    return jsonError(req, 'booking_id is required', 400);
  }

  const { property } = await resolveScopedPropertyAccess(req, 'bookings:view');
  await verifyBookingBelongsToProperty(bookingId, property.id);

  const sb = createServiceClient();
  const { data, error } = await sb
    .from('ai_dashboard_assistant_action_audit')
    .select('id, tool_name, risk_tier, result_status, result_summary, created_at')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false });
  if (error) {
    return jsonError(req, `Failed to load audit trail: ${error.message}`, 500);
  }

  return jsonSuccess(req, { entries: data ?? [] });
});
