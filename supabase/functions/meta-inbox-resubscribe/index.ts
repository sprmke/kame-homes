/**
 * meta-inbox-resubscribe — re-checks the effective Meta page webhook and repairs it if needed.
 */

import { resolveInboxAccess } from '../_shared/inboxAccess.ts';
import { reconcileMetaConnectionWebhook } from '../_shared/metaInboxWebhookHealth.ts';
import { resolveEffectiveMetaConnection } from '../_shared/metaInboxScope.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { featureUnavailableResponse } from '../_shared/featureAvailability.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('meta-inbox-resubscribe', async (req, user) => {
  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const featureBlocked = await featureUnavailableResponse(req, 'inbox.meta.connect', { user });
  if (featureBlocked) return featureBlocked;

  const body = (await readJsonBody(req)) as Record<string, unknown>;
  const ctx = await resolveInboxAccess(req, 'channels_add', body);
  const effective = await resolveEffectiveMetaConnection(ctx.orgId, ctx.scope);
  const facebook = effective.connections.find((connection) => connection.platform === 'facebook');

  if (!facebook) {
    return jsonError(req, 'No connected Meta page found for this inbox', 404);
  }

  const result = await reconcileMetaConnectionWebhook(facebook);
  return jsonSuccess(req, result);
});
