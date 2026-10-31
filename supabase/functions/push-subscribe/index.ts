/**
 * Register (or refresh) a Web Push subscription for the signed-in user's device.
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

type IncomingSubscription = {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
};

serveAuthenticated('push-subscribe', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);

  const sub = (body.subscription ?? body) as IncomingSubscription;
  const endpoint = typeof sub.endpoint === 'string' ? sub.endpoint.trim() : '';
  const p256dh = typeof sub.keys?.p256dh === 'string' ? sub.keys.p256dh : '';
  const auth = typeof sub.keys?.auth === 'string' ? sub.keys.auth : '';

  if (!endpoint || !p256dh || !auth) {
    return jsonError(req, 'subscription { endpoint, keys.p256dh, keys.auth } is required');
  }

  const userAgent =
    typeof body.userAgent === 'string'
      ? body.userAgent.slice(0, 512)
      : (req.headers.get('user-agent') ?? '').slice(0, 512);
  const platform = typeof body.platform === 'string' ? body.platform.slice(0, 64) : null;

  const sb = createServiceClient();
  const { error } = await sb.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: userAgent || null,
      platform,
      last_seen_at: new Date().toISOString(),
      failure_count: 0,
      disabled_at: null,
    },
    { onConflict: 'endpoint' }
  );

  if (error) return jsonError(req, error.message, 500);
  return jsonSuccess(req, { ok: true });
});
