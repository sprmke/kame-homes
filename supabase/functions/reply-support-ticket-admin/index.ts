/**
 * reply-support-ticket-admin — POST super-admin reply to a ticket, notifies the submitter.
 */

import { loadAuthUserProfile } from '../_shared/authUserProfile.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { sendSupportTicketReplyNotify } from '../_shared/emailService.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';
import { logSuperAdminAction } from '../_shared/superAdminAudit.ts';
import {
  loadSupportTicketNotifyContext,
  touchSupportTicketActivity,
} from '../_shared/supportTicketAccess.ts';
import { statusAfterAdminReply } from '../_shared/supportTicketStatus.ts';

serveSuperAdmin('reply-support-ticket-admin', async (req, adminUser) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);

  const ticketId = typeof body.ticketId === 'string' ? body.ticketId.trim() : '';
  if (!ticketId) return jsonError(req, 'ticketId is required');

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return jsonError(req, 'message is required');
  if (message.length > 5000) return jsonError(req, 'message must be 5000 characters or fewer');

  const sb = createServiceClient();

  const { data: ticket, error: ticketError } = await sb
    .from('support_tickets')
    .select('id, subject, submitted_by_email, status, channel')
    .eq('id', ticketId)
    .maybeSingle();

  if (ticketError) throw new Error(ticketError.message);
  if (!ticket) return jsonError(req, 'Ticket not found', 404);

  const profile = await loadAuthUserProfile(sb, adminUser.id);

  const { data: created, error: insertError } = await sb
    .from('support_ticket_messages')
    .insert({
      ticket_id: ticketId,
      sender_type: 'admin',
      sender_user_id: adminUser.id,
      sender_name: profile.name || 'Support',
      body: message,
      attachments: [],
    })
    .select('*')
    .single();

  if (insertError || !created) {
    return jsonError(req, `Failed to save reply: ${insertError?.message ?? 'unknown error'}`, 500);
  }

  const nextStatus = statusAfterAdminReply(ticket.status);
  await touchSupportTicketActivity(sb, ticketId, nextStatus ?? undefined);

  try {
    const notifyCtx = await loadSupportTicketNotifyContext(sb, ticketId);
    if (notifyCtx) {
      await sendSupportTicketReplyNotify({
        id: notifyCtx.id,
        channel: notifyCtx.channel,
        orgSlug: notifyCtx.organizationSlug,
        propertySlug: notifyCtx.propertySlug,
        parkingSlug: notifyCtx.parkingSlug,
        subject: notifyCtx.subject,
        submittedByEmail: notifyCtx.submitted_by_email,
      });
    }
  } catch (notifyErr) {
    console.error('[reply-support-ticket-admin] notify email failed (non-fatal):', notifyErr);
  }

  await logSuperAdminAction(adminUser, {
    action: 'support.ticket_replied',
    targetType: 'support_ticket',
    targetId: ticketId,
    summary: 'Replied to support ticket',
  });

  return jsonSuccess(req, { message: created });
});
