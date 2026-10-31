/**
 * check-organization-name — GET whether a display name is available globally.
 * Auth: verifyAuthenticatedUser.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  DUPLICATE_ORGANIZATION_NAME_MESSAGE,
  findOrganizationNameConflict,
} from '../_shared/orgNameConflict.ts';
import { getReservedDisplayNameViolation } from '../_shared/reservedDisplayNames.ts';
import { jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('check-organization-name', async (req) => {
  requireHttpMethod(req, 'GET');

  const url = new URL(req.url);
  const name = url.searchParams.get('name')?.trim() ?? '';
  const excludeOrgId = url.searchParams.get('excludeOrgId')?.trim() || undefined;

  if (name.length < 2) {
    return jsonSuccess(req, { available: false, reason: 'too_short' });
  }

  const reservedMessage = getReservedDisplayNameViolation(name);
  if (reservedMessage) {
    return jsonSuccess(req, {
      available: false,
      reason: 'reserved',
      message: reservedMessage,
    });
  }

  const supabase = createServiceClient();
  const conflict = await findOrganizationNameConflict(supabase, name, excludeOrgId);

  return jsonSuccess(req, {
    available: !conflict,
    message: conflict ? DUPLICATE_ORGANIZATION_NAME_MESSAGE : null,
  });
});
