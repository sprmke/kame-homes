/**
 * Disconnect Meta inbox channels for property/parking override or inherited org default.
 */

import { resolveInboxAccess } from '../_shared/inboxAccess.ts';
import {
  clearOrgMetaInbox,
  clearParkingMetaInbox,
  clearPropertyMetaInbox,
} from '../_shared/metaInboxLifecycle.ts';
import { listPropertyOverrideMetaConnections } from '../_shared/metaInboxScope.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { featureUnavailableResponse } from '../_shared/featureAvailability.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { logAssetActivity } from '../_shared/assetActivity.ts';

serveAuthenticated('meta-inbox-disconnect', async (req, user) => {
  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const featureBlocked = await featureUnavailableResponse(req, 'inbox.meta.connect', { user });
  if (featureBlocked) return featureBlocked;

  const body = (await readJsonBody(req)) as Record<string, unknown>;
  const ctx = await resolveInboxAccess(req, 'channels_delete', body);
  const platform = typeof body.platform === 'string' ? body.platform : 'meta';
  const deleteMessages = true;

  if (platform !== 'meta' && platform !== 'facebook' && platform !== 'instagram') {
    return jsonError(req, 'Invalid platform', 400);
  }

  if (platform !== 'meta') {
    return jsonError(req, 'Disconnect Meta as a whole from Channels', 400);
  }

  let conversationsCleared = 0;
  let connectionsRemoved = 0;

  if (ctx.kind === 'property' && ctx.propertyId) {
    const overrides = await listPropertyOverrideMetaConnections(ctx.orgId, ctx.propertyId);
    const hasConnectedOverride = overrides.some((c) => c.status === 'connected');
    if (hasConnectedOverride) {
      ({ conversationsCleared, connectionsRemoved } = await clearPropertyMetaInbox(
        ctx.orgId,
        ctx.propertyId,
        { deleteConversations: deleteMessages }
      ));
    } else {
      // Managing inherited org-default Meta from property (no org Inbox UI).
      ({ conversationsCleared, connectionsRemoved } = await clearOrgMetaInbox(ctx.orgId, {
        deleteConversations: deleteMessages,
      }));
    }
  } else if (ctx.kind === 'parking' && ctx.parkingId) {
    ({ conversationsCleared, connectionsRemoved } = await clearParkingMetaInbox(
      ctx.orgId,
      ctx.parkingId,
      { deleteConversations: deleteMessages }
    ));
  }

  await logAssetActivity({
    req,
    user,
    action: 'integrations.disconnected',
    organizationId: ctx.orgId,
    propertyId: ctx.kind === 'property' ? (ctx.propertyId ?? null) : null,
    parkingId: ctx.kind === 'parking' ? (ctx.parkingId ?? null) : null,
    targetType: 'integration',
    targetId: ctx.parkingId ?? ctx.propertyId ?? ctx.orgId,
    metadata: {
      provider: 'meta_inbox',
      connections_removed: connectionsRemoved,
      conversations_cleared: conversationsCleared,
    },
  });

  return jsonSuccess(req, {
    disconnected: connectionsRemoved,
    conversationsCleared,
  });
});
