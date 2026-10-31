/**
 * reopen-support-ticket — POST host/guest reopens a closed ticket (no message).
 * Logic: _shared/supportTicketSubmitterActions.ts (shared with the assistant's ticket tools).
 */

import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { resolveSupportTicketScope } from '../_shared/supportTicketScope.ts';
import {
  reopenSupportTicket,
  SupportTicketActionError,
} from '../_shared/supportTicketSubmitterActions.ts';

serveAuthenticated('reopen-support-ticket', async (req) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);

  const ticketId = typeof body.ticketId === 'string' ? body.ticketId.trim() : '';
  if (!ticketId) return jsonError(req, 'ticketId is required');

  const scope = await resolveSupportTicketScope(req, {
    orgSlug: typeof body.orgSlug === 'string' ? body.orgSlug : null,
    orgId: typeof body.orgId === 'string' ? body.orgId : null,
    propertyId: typeof body.propertyId === 'string' ? body.propertyId : null,
    parkingId: typeof body.parkingId === 'string' ? body.parkingId : null,
  });

  try {
    const { ticket } = await reopenSupportTicket(scope, ticketId);
    return jsonSuccess(req, { ticket });
  } catch (err) {
    if (err instanceof SupportTicketActionError) return jsonError(req, err.message, err.status);
    throw err;
  }
});
