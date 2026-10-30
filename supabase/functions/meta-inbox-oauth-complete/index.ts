/**
 * Complete Meta OAuth by connecting the selected Facebook Page.
 */

import { decryptMetaInboxToken } from '../_shared/metaInboxCrypto.ts';
import {
  connectMetaInboxPage,
  resolveMetaPageFromUserToken,
  type MetaPagePickerOption,
} from '../_shared/metaInboxConnect.ts';
import { resolveInboxAccess } from '../_shared/inboxAccess.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { featureUnavailableResponse } from '../_shared/featureAvailability.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { logAssetActivity } from '../_shared/assetActivity.ts';

serveAuthenticated('meta-inbox-oauth-complete', async (req, user) => {
  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const featureBlocked = await featureUnavailableResponse(req, 'inbox.meta.connect', { user });
  if (featureBlocked) return featureBlocked;

  const body = (await readJsonBody(req)) as Record<string, unknown>;
  const ctx = await resolveInboxAccess(req, 'channels_add', body);
  const pickerState = String(body.pickerState ?? '').trim();
  const pageId = String(body.pageId ?? '').trim();
  if (!pickerState || !pageId) {
    return jsonError(req, 'pickerState and pageId required', 400);
  }

  const sb = createServiceClient();
  const { data, error } = await sb
    .from('meta_inbox_oauth_state')
    .select(
      'organization_id, user_id, expires_at, pending_pages, encrypted_user_token, property_id, parking_id'
    )
    .eq('state', pickerState)
    .maybeSingle();

  if (error || !data) {
    return jsonError(req, 'Picker session not found', 404);
  }

  const exp = new Date(data.expires_at as string).getTime();
  const pending = (data.pending_pages ?? []) as MetaPagePickerOption[];
  const statePropertyId = (data.property_id as string | null) ?? null;
  const stateParkingId = (data.parking_id as string | null) ?? null;
  if (
    data.organization_id !== ctx.orgId ||
    data.user_id !== user.id ||
    Number.isNaN(exp) ||
    Date.now() > exp ||
    !pending.length ||
    !data.encrypted_user_token ||
    !pending.some((p) => p.id === pageId) ||
    statePropertyId !== ctx.propertyId ||
    stateParkingId !== ctx.parkingId
  ) {
    return jsonError(req, 'Picker session expired', 404);
  }

  try {
    const userToken = await decryptMetaInboxToken(data.encrypted_user_token as string);
    const page = await resolveMetaPageFromUserToken(userToken, pageId);
    if (!page) {
      return jsonError(req, 'Page not available', 400);
    }

    await connectMetaInboxPage(ctx.orgId, page, {
      propertyId: ctx.propertyId,
      parkingId: ctx.parkingId,
    });
    await sb.from('meta_inbox_oauth_state').delete().eq('state', pickerState);

    await logAssetActivity({
      req,
      user,
      action: 'integrations.connected',
      organizationId: ctx.orgId,
      propertyId: ctx.propertyId ?? null,
      parkingId: ctx.parkingId ?? null,
      targetType: 'integration',
      targetId: ctx.parkingId ?? ctx.propertyId ?? ctx.orgId,
      targetLabel: page.name,
      metadata: { provider: 'meta_inbox', page_name: page.name },
    });

    return jsonSuccess(req, { connected: true, pageName: page.name });
  } catch (e) {
    console.error('[meta-inbox-oauth-complete]', e);
    return jsonError(req, (e as Error).message, 500);
  }
});
