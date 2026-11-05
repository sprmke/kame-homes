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
  captureFaultIfServerError,
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import {
  loadNotificationPreferencesForUsers,
  shouldDeliverPush,
} from '../_shared/notificationPreferences.ts';
import {
  loadPushSubscriptions,
  type NotificationRow,
  reconcilePushFailures,
  resolveNotificationClickPath,
  countUnreadForUser,
  resolveNotificationRecipientUserIds,
} from '../_shared/pushRecipients.ts';
import {
  buildPushPayload,
  isPushConfigured,
  sendPushBatch,
} from '../_shared/webPushService.ts';

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

  // A trigger, not a user request, so nobody sees this 500. Without the capture, a broken
  // notifications read means push silently stops and the only signal is a guest saying they
  // were never notified.
  if (error) {
    await captureFaultIfServerError(req, new Error(error.message), 'push-fanout');
    return jsonError(req, error.message, 500);
  }
  if (!notification) return jsonSuccess(req, { sent: 0, reason: 'notification not found' });

  const row = notification as NotificationRow;
  const userIds = await resolveNotificationRecipientUserIds(sb, row);
  const subs = await loadPushSubscriptions(sb, userIds);
  if (subs.length === 0) return jsonSuccess(req, { sent: 0, recipients: userIds.length });

  const path = await resolveNotificationClickPath(sb, row);

  // Encrypted Web Push payloads are capped near 4 KB; keep the body well inside it
  // and never widen guest PII beyond what the bell already shows (6.9).
  const basePayload = buildPushPayload(row, path);

  // The OS badge is per user, so the fan-out groups subscriptions by owner and
  // sends each group its own unread count (6.3).
  const subsByUser = new Map<string, typeof subs>();
  for (const sub of subs) {
    const key = sub.user_id ?? 'unknown';
    const list = subsByUser.get(key) ?? [];
    list.push(sub);
    subsByUser.set(key, list);
  }

  // Per-user preferences: a muted group or an active quiet window suppresses the
  // OS push only. The in-app notification row (and the bell badge) is unaffected.
  const prefsByUser = await loadNotificationPreferencesForUsers(sb, [
    ...subsByUser.keys(),
  ].filter((id) => id !== 'unknown'));
  const now = new Date();
  let muted = 0;
  let quiet = 0;

  const results: Awaited<ReturnType<typeof sendPushBatch>> = [];
  for (const [userId, userSubs] of subsByUser) {
    if (userId !== 'unknown') {
      const prefs = prefsByUser.get(userId);
      if (prefs) {
        const decision = shouldDeliverPush(row.type, prefs, now);
        if (!decision.deliver) {
          if (decision.reason === 'quiet_hours') quiet += userSubs.length;
          else muted += userSubs.length;
          continue;
        }
      }
    }
    const unreadCount =
      userId === 'unknown' ? undefined : await countUnreadForUser(sb, row, userId);
    const batchResults = await sendPushBatch(userSubs, { ...basePayload, unreadCount });
    results.push(...batchResults);
  }

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
    muted,
    quiet,
  };
  console.log('[push-fanout]', JSON.stringify(summary));
  return jsonSuccess(req, summary);
});
