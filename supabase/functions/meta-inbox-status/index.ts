/**
 * Meta inbox connection status for org / property / parking scope.
 */

import { resolveInboxAccess } from '../_shared/inboxAccess.ts';
import { resolveEffectiveMetaConnection } from '../_shared/metaInboxScope.ts';
import { metaBackfillHasMore } from '../_shared/socialInboxService.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('meta-inbox-status', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }
  const ctx = await resolveInboxAccess(req, 'view');
  const effective = await resolveEffectiveMetaConnection(ctx.orgId, ctx.scope);

  // Property/parking Channels show the effective Page (override or inherited org default).
  const connectionsForUi = effective.connections;

  const serialized = connectionsForUi.map((c) => ({
    id: c.id,
    platform: c.platform,
    displayName: c.display_name,
    profileImageUrl: c.profile_image_url,
    status: c.status,
    connectedAt: c.webhook_subscribed_at ?? c.updated_at,
    lastSyncAt: c.last_sync_at,
    webhookSubscribed: Boolean(c.webhook_subscribed_at),
    webhookLastVerifiedAt: c.webhook_last_verified_at ?? null,
    webhookVerifyAttempts: c.webhook_verify_attempts ?? 0,
    webhookNeedsAttention: (c.webhook_verify_attempts ?? 0) >= 3,
    errorMessage: c.error_message,
    propertyId: c.property_id ?? null,
    parkingId: c.parking_id ?? null,
  }));

  const facebook = effective.connection;
  const metaSyncError = facebook?.error_message ?? null;
  // A recorded error on a never-synced connection means the last attempt failed for good
  // (bad/expired token, etc.) — stop reporting "in progress" so the client stops spinning
  // and prompts reconnect instead of polling forever.
  const metaSyncInProgress = Boolean(facebook && !facebook.last_sync_at && !metaSyncError);
  const metaHasMore = metaBackfillHasMore(facebook);

  return jsonSuccess(req, {
    connections: serialized,
    metaConfigured: Boolean(Deno.env.get('META_APP_ID')?.trim()),
    metaSyncInProgress,
    metaSyncError: facebook && !facebook.last_sync_at ? metaSyncError : null,
    metaHasMore,
    metaSource: effective.source,
    usingOrgMeta: effective.source === 'org',
  });
});
