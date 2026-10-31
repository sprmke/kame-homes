/**
 * Fan a freshly inserted notification out to Web Push endpoints.
 * Plan: docs/workflow/in-progress/pwa-installable-offline-push.md (Phase 3)
 *
 * Called by the AFTER INSERT trigger on `notifications` via pg_net
 * (20261303120100_push_fanout_trigger.sql). Secret-gated (`X-Push-Fanout-Secret`),
 * `verify_jwt = false`. Non-fatal end to end — a bad send never surfaces to the
 * caller as anything other than a count.
 */
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import {
  loadPushSubscriptions,
  type NotificationRow,
  reconcilePushFailures,
  resolveNotificationClickPath,
  resolveNotificationRecipientUserIds,
} from '../_shared/pushRecipients.ts';
import { isPushConfigured, type PushPayload, sendPushBatch } from '../_shared/webPushService.ts';

servePublic('push-fanout', async (req) => {
  requireHttpMethod(req, 'POST');

  const expected = Deno.env.get('PUSH_FANOUT_SECRET') ?? '';
  const provided = req.headers.get('x-push-fanout-secret') ?? '';
  if (!expected || provided !== expected) {
    return jsonError(req, 'Unauthorized', 401);
  }

  if (!isPushConfigured()) {
    return jsonSuccess(req, { sent: 0, skipped: 'push not configured' });
  }

  const body = await readJsonBody(req);
  const notificationId = typeof body.notificationId === 'string' ? body.notificationId.trim() : '';
  if (!notificationId) return jsonError(req, 'notificationId is required');

  const sb = createServiceClient();
  const { data: notification, error } = await sb
    .from('notifications')
    .select(
      'id, organization_id, type, title, body, booking_id, conversation_id, property_id, parking_id, metadata'
    )
    .eq('id', notificationId)
    .maybeSingle();

  if (error) return jsonError(req, error.message, 500);
  if (!notification) return jsonSuccess(req, { sent: 0, reason: 'notification not found' });

  const row = notification as NotificationRow;
  const userIds = await resolveNotificationRecipientUserIds(sb, row.organization_id);
  const subs = await loadPushSubscriptions(sb, userIds);
  if (subs.length === 0) return jsonSuccess(req, { sent: 0, recipients: userIds.length });

  const path = await resolveNotificationClickPath(sb, row);
  const payload: PushPayload = {
    title: row.title,
    body: row.body ?? undefined,
    path,
    type: row.type,
    notificationId: row.id,
  };

  const results = await sendPushBatch(subs, payload);
  const sent = results.filter((r) => r.ok).length;
  const goneIds = results.filter((r) => !r.ok && r.gone).map((r) => r.id);
  const failedIds = results.filter((r) => !r.ok && !r.gone).map((r) => r.id);
  await reconcilePushFailures(sb, goneIds, failedIds);

  const summary = {
    notificationId: row.id,
    type: row.type,
    recipients: userIds.length,
    endpoints: subs.length,
    sent,
    pruned: goneIds.length,
    failed: failedIds.length,
  };
  console.log('[push-fanout]', JSON.stringify(summary));
  return jsonSuccess(req, summary);
});
