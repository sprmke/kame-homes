/**
 * update-support-ticket-status — POST super-admin status/priority update.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { sendSupportTicketStatusNotify } from '../_shared/emailService.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';
import { logSuperAdminAction } from '../_shared/superAdminAudit.ts';
import { loadSupportTicketNotifyContext } from '../_shared/supportTicketAccess.ts';

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const PRIORITIES = ['low', 'medium', 'high'];

serveSuperAdmin('update-support-ticket-status', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);

  const ticketId = typeof body.ticketId === 'string' ? body.ticketId.trim() : '';
  if (!ticketId) return jsonError(req, 'ticketId is required');

  const updates: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !STATUSES.includes(body.status)) {
      return jsonError(req, 'status must be open, in_progress, resolved, or closed');
    }
    updates.status = body.status;
  }

  if (body.priority !== undefined) {
    if (
      body.priority !== null &&
      (typeof body.priority !== 'string' || !PRIORITIES.includes(body.priority))
    ) {
      return jsonError(req, 'priority must be low, medium, high, or null');
    }
    updates.priority = body.priority;
  }

  if (Object.keys(updates).length === 0) {
    return jsonError(req, 'status or priority is required');
  }

  const sb = createServiceClient();

  const { data: before, error: beforeError } = await sb
    .from('support_tickets')
    .select('status')
    .eq('id', ticketId)
    .maybeSingle();

  if (beforeError) throw new Error(beforeError.message);
  if (!before) return jsonError(req, 'Ticket not found', 404);

  const { data, error } = await sb
    .from('support_tickets')
    .update(updates)
    .eq('id', ticketId)
    .select('*')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return jsonError(req, 'Ticket not found', 404);

  const newStatus = typeof updates.status === 'string' ? updates.status : null;
  if (
    newStatus &&
    newStatus !== before.status &&
    (newStatus === 'resolved' || newStatus === 'closed')
  ) {
    try {
      const notifyCtx = await loadSupportTicketNotifyContext(sb, ticketId);
      if (notifyCtx) {
        await sendSupportTicketStatusNotify({
          id: notifyCtx.id,
          channel: notifyCtx.channel,
          orgSlug: notifyCtx.organizationSlug,
          propertySlug: notifyCtx.propertySlug,
          parkingSlug: notifyCtx.parkingSlug,
          subject: notifyCtx.subject,
          status: newStatus,
          submittedByEmail: notifyCtx.submitted_by_email,
        });
      }
    } catch (notifyErr) {
      console.error('[update-support-ticket-status] status notify failed (non-fatal):', notifyErr);
    }
  }

  await logSuperAdminAction(user, {
    action: 'support.ticket_status_updated',
    targetType: 'support_ticket',
    targetId: ticketId,
    summary: 'Updated support ticket status',
    metadata: { fields: Object.keys(updates) },
  });

  return jsonSuccess(req, { ticket: data });
});
