/**
 * reply-support-ticket — POST host/guest adds a reply to an existing ticket thread.
 * Logic: _shared/supportTicketSubmitterActions.ts (shared with the assistant's ticket tools).
 */

import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { validateSupportTicketAttachments } from '../_shared/supportTicketAttachments.ts';
import { resolveSupportTicketScope } from '../_shared/supportTicketScope.ts';
import {
  replyToSupportTicket,
  SupportTicketActionError,
} from '../_shared/supportTicketSubmitterActions.ts';

serveAuthenticated('reply-support-ticket', async (req) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);

  const ticketId = typeof body.ticketId === 'string' ? body.ticketId.trim() : '';
  if (!ticketId) return jsonError(req, 'ticketId is required');
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return jsonError(req, 'message is required');
  if (message.length > 5000) return jsonError(req, 'message must be 5000 characters or fewer');

  const scope = await resolveSupportTicketScope(req, {
    orgSlug: typeof body.orgSlug === 'string' ? body.orgSlug : null,
    orgId: typeof body.orgId === 'string' ? body.orgId : null,
    propertyId: typeof body.propertyId === 'string' ? body.propertyId : null,
    parkingId: typeof body.parkingId === 'string' ? body.parkingId : null,
  });

  let attachments;
  try {
    attachments = validateSupportTicketAttachments(body.attachments, scope);
  } catch {
    return jsonError(req, 'Invalid attachment path', 400);
  }

  try {
    const { message: created } = await replyToSupportTicket(scope, {
      ticketId,
      message,
      attachments,
    });
    return jsonSuccess(req, { message: created });
  } catch (err) {
    if (err instanceof SupportTicketActionError) return jsonError(req, err.message, err.status);
    throw err;
  }
});
