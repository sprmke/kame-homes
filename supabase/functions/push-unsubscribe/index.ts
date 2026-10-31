/**
 * Remove a Web Push subscription (device opted out, or signed out).
 * Plan: docs/workflow/in-progress/pwa-installable-offline-push.md (Phase 3)
 */
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('push-unsubscribe', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : '';
  if (!endpoint) return jsonError(req, 'endpoint is required');

  const sb = createServiceClient();
  const { error } = await sb
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('user_id', user.id);

  if (error) return jsonError(req, error.message, 500);
  return jsonSuccess(req, { ok: true });
});
