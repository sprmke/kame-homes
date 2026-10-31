/**
 * list-support-tickets — GET the caller's own tickets.
 * Host scope: org-filtered. Guest explore: channel=guest for this user.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { resolveSupportTicketScope } from '../_shared/supportTicketScope.ts';

serveAuthenticated('list-support-tickets', async (req) => {
  requireHttpMethod(req, 'GET');
  const url = new URL(req.url);

  const scope = await resolveSupportTicketScope(req, {
    orgSlug: url.searchParams.get('org_slug'),
    orgId: url.searchParams.get('org_id'),
    propertyId: url.searchParams.get('property_id'),
    parkingId: url.searchParams.get('parking_id'),
  });

  const sb = createServiceClient();
  let query = sb
    .from('support_tickets')
    .select('*')
    .eq('submitted_by_user_id', scope.user.id)
    .order('updated_at', { ascending: false })
    .limit(200);

  if (scope.channel === 'guest') {
    query = query.eq('channel', 'guest');
  } else if (scope.org) {
    query = query.eq('organization_id', scope.org.id).eq('channel', 'host');
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return jsonSuccess(req, { tickets: data ?? [] });
});
