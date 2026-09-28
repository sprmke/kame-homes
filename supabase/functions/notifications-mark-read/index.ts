/**
 * Mark one notification, or all unread notifications in scope, as read for the caller.
 * Logic: _shared/notificationsMarkRead.ts (shared with the assistant's mark-read tool).
 */

import { resolveNotificationsAccess } from '../_shared/notificationsAccess.ts';
import {
  markNotificationsRead,
  NotificationMarkReadError,
} from '../_shared/notificationsMarkRead.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('notifications-mark-read', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);
  const ctx = await resolveNotificationsAccess(req, body);
  if (ctx.planLimited) {
    return jsonSuccess(req, { markedCount: 0 });
  }

  const markAll = body.markAll === true;
  const notificationId = typeof body.notificationId === 'string' ? body.notificationId.trim() : '';
  if (!markAll && !notificationId) {
    return jsonError(req, 'notificationId or markAll is required');
  }

  try {
    const result = await markNotificationsRead(
      ctx,
      user.id,
      markAll ? { markAll: true } : { notificationId }
    );
    return jsonSuccess(req, result);
  } catch (err) {
    if (err instanceof NotificationMarkReadError) return jsonError(req, err.message, err.status);
    throw err;
  }
});
