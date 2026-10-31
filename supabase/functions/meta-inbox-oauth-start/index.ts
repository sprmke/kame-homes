/**
 * Start Meta OAuth for org / property / parking social inbox.
 */

import { buildMetaOAuthUrl } from '../_shared/metaInboxGraph.ts';
import { isMetaReturnOriginAllowed, sanitizeMetaReturnPath } from '../_shared/metaInboxConfig.ts';
import { resolveInboxAccess } from '../_shared/inboxAccess.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import {
  catchPlanFeatureError,
  requireOrgPropertyFeature,
  requirePropertyFeature,
} from '../_shared/planEntitlements.ts';
import { featureUnavailableResponse } from '../_shared/featureAvailability.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

serveAuthenticated('meta-inbox-oauth-start', async (req, user) => {
  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const featureBlocked = await featureUnavailableResponse(req, 'inbox.meta.connect', { user });
  if (featureBlocked) return featureBlocked;

  let body: Record<string, unknown> = {};
  try {
    body = (await readJsonBody(req)) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const ctx = await resolveInboxAccess(req, 'channels_add', body);

  try {
    if (ctx.propertyId) {
      await requirePropertyFeature(ctx.propertyId, 'metaChatChannel');
    } else {
      await requireOrgPropertyFeature(ctx.orgId, 'metaChatChannel');
    }
  } catch (err) {
    const planErr = catchPlanFeatureError(req, err);
    if (planErr) return planErr;
    throw err;
  }

  let returnPath = '/inbox';
  if (typeof body.returnPath === 'string') {
    returnPath = sanitizeMetaReturnPath(body.returnPath);
  }

  const originHeader = req.headers.get('Origin') ?? req.headers.get('Referer') ?? '';
  let returnOrigin = '';
  if (originHeader.startsWith('http://') || originHeader.startsWith('https://')) {
    try {
      const u = new URL(originHeader);
      returnOrigin = `${u.protocol}//${u.host}`;
    } catch {
      returnOrigin = '';
    }
  }
  if (!returnOrigin || !isMetaReturnOriginAllowed(returnOrigin)) {
    return jsonError(req, 'Invalid return origin', 400);
  }

  const state = randomState();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const sb = createServiceClient();
  const { error } = await sb.from('meta_inbox_oauth_state').insert({
    state,
    organization_id: ctx.orgId,
    user_id: user.id,
    expires_at: expiresAt,
    return_origin: returnOrigin,
    return_path: returnPath,
    property_id: ctx.propertyId,
    parking_id: ctx.parkingId,
  });
  if (error) {
    console.error('[meta-inbox-oauth-start]', error);
    return jsonError(req, 'Failed to start OAuth', 500);
  }

  return jsonSuccess(req, { url: buildMetaOAuthUrl(state) });
});
