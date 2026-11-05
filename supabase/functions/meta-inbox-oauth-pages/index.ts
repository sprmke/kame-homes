/**
 * List Facebook Pages pending selection after Meta OAuth.
 */

import type { MetaPagePickerOption } from '../_shared/metaInboxConnect.ts';
import {
  createServiceClient,
  verifyParkingTeamAccess,
  verifyPropertyAccess,
} from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { featureUnavailableResponse } from '../_shared/featureAvailability.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('meta-inbox-oauth-pages', async (req, user) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const featureBlocked = await featureUnavailableResponse(req, 'inbox.meta.connect', { user });
  if (featureBlocked) return featureBlocked;

  const picker = new URL(req.url).searchParams.get('picker')?.trim();
  if (!picker) {
    return jsonError(req, 'picker query param required', 400);
  }

  const sb = createServiceClient();
  const { data, error } = await sb
    .from('meta_inbox_oauth_state')
    .select(
      'organization_id, user_id, expires_at, pending_pages, encrypted_user_token, property_id, parking_id'
    )
    .eq('state', picker)
    .maybeSingle();

  if (error || !data) {
    return jsonError(req, 'Picker session not found', 404);
  }

  const exp = new Date(data.expires_at as string).getTime();
  const propertyId = (data.property_id as string | null) ?? null;
  const parkingId = (data.parking_id as string | null) ?? null;

  if (
    data.user_id !== user.id ||
    Number.isNaN(exp) ||
    Date.now() > exp ||
    !data.pending_pages ||
    !data.encrypted_user_token
  ) {
    return jsonError(req, 'Picker session expired', 404);
  }

  if (propertyId) {
    // Phase 6: property uses leaf ids (retired inbox:manage expands on read only).
    const ctx = await verifyPropertyAccess(req, propertyId, 'inbox.channels:add');
    if (ctx.org.id !== data.organization_id) {
      return jsonError(req, 'Picker session expired', 404);
    }
  } else if (parkingId) {
    const ctx = await verifyParkingTeamAccess(req, parkingId, 'inbox:manage');
    if (ctx.org.id !== data.organization_id) {
      return jsonError(req, 'Picker session expired', 404);
    }
  } else {
    return jsonError(req, 'Picker session missing scope', 404);
  }

  return jsonSuccess(req, {
    pages: data.pending_pages as MetaPagePickerOption[],
  });
});
