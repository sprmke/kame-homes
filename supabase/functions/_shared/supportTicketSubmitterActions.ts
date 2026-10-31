/**
 * Submitter-side support ticket actions (reply, reopen) — shared by `reply-support-ticket`,
 * `reopen-support-ticket` and the assistant's ticket tools. Callers resolve the ticket scope
 * first (`resolveSupportTicketScope`). Errors carry an HTTP status for the endpoints.
 */

import { loadAuthUserProfile } from './authUserProfile.ts';
import { sendSupportTicketSubmitterReplyNotify } from './emailService.ts';
import { createServiceClient } from './orgAuth.ts';
import { touchSupportTicketActivity } from './supportTicketAccess.ts';
import type { SupportTicketScope } from './supportTicketScope.ts';
import {
  canSubmitterReply,
  statusAfterReopen,
  statusAfterSubmitterReply,
} from './supportTicketStatus.ts';

export const SUPPORT_REPLY_MAX = 5000;

export class SupportTicketActionError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function loadOwnTicket(scope: SupportTicketScope, ticketId: string) {
  const sb = createServiceClient();
  let ticketQuery = sb
    .from('support_tickets')
    .select('id, status, subject, category')
    .eq('id', ticketId)
    .eq('submitted_by_user_id', scope.user.id);
  if (scope.channel === 'guest') {
    ticketQuery = ticketQuery.eq('channel', 'guest');
  } else if (scope.org) {
    ticketQuery = ticketQuery.eq('organization_id', scope.org.id).eq('channel', 'host');
  }
  const { data: ticket, error } = await ticketQuery.maybeSingle();
  if (error) throw new Error(error.message);
  if (!ticket) throw new SupportTicketActionError('Ticket not found', 404);
  return ticket as { id: string; status: string; subject: string; category: string };
}

export async function replyToSupportTicket(
  scope: SupportTicketScope,
  input: { ticketId: string; message: string; attachments: unknown[] }
) {
  const message = input.message.trim();
  if (!message) throw new SupportTicketActionError('message is required', 400);
  if (message.length > SUPPORT_REPLY_MAX) {
    throw new SupportTicketActionError('message must be 5000 characters or fewer', 400);
  }
  const ticket = await loadOwnTicket(scope, input.ticketId);
  if (!canSubmitterReply(ticket.status)) {
    throw new SupportTicketActionError(
      'This ticket is closed. Reopen it before sending a reply.',
      409
    );
  }

  const sb = createServiceClient();
  const profile = await loadAuthUserProfile(sb, scope.user.id);
  const senderType = scope.channel === 'guest' ? 'guest' : 'host';
  const { data: created, error: insertError } = await sb
    .from('support_ticket_messages')
    .insert({
      ticket_id: input.ticketId,
      sender_type: senderType,
      sender_user_id: scope.user.id,
      sender_name: profile.name,
      body: message,
      attachments: input.attachments,
    })
    .select('*')
    .single();
  if (insertError || !created) {
    throw new SupportTicketActionError(
      `Failed to save reply: ${insertError?.message ?? 'unknown error'}`,
      500
    );
  }

  const nextStatus = statusAfterSubmitterReply(ticket.status);
  await touchSupportTicketActivity(sb, input.ticketId, nextStatus ?? undefined);

  try {
    await sendSupportTicketSubmitterReplyNotify({
      ticketId: input.ticketId,
      subject: ticket.subject,
      category: ticket.category,
      submittedByName: profile.name,
      submittedByEmail: profile.email || scope.user.email,
      bodyPreview: message,
      organizationName: scope.org?.name ?? 'Explore guest',
      propertyName: scope.propertyName,
      parkingName: scope.parkingName,
    });
  } catch (notifyErr) {
    console.error('[supportTicketSubmitterActions] team notify failed (non-fatal):', notifyErr);
  }

  return { message: created, subject: ticket.subject };
}

export async function reopenSupportTicket(scope: SupportTicketScope, ticketId: string) {
  const ticket = await loadOwnTicket(scope, ticketId);
  if (ticket.status !== 'closed') {
    throw new SupportTicketActionError('Only closed tickets can be reopened this way', 409);
  }
  const { data: updated, error } = await createServiceClient()
    .from('support_tickets')
    .update({ status: statusAfterReopen() })
    .eq('id', ticketId)
    .select('*')
    .single();
  if (error || !updated) {
    throw new SupportTicketActionError(
      `Failed to reopen ticket: ${error?.message ?? 'unknown error'}`,
      500
    );
  }
  return { ticket: updated, subject: ticket.subject };
}
