/**
 * Quick reply template CRUD for Guest Inbox (org-scoped for property; parking-scoped for parking; property/parking manage ACL).
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { seedDefaultInboxQuickRepliesIfEmpty } from '../_shared/inboxDefaultQuickReplies.ts';
import { resolveInboxAccess } from '../_shared/inboxAccess.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import {
  createQuickReplyTemplate,
  deleteQuickReplyTemplate,
  requireQuickRepliesPlan,
  updateQuickReplyTemplate,
} from '../_shared/inboxQuickReplyTemplates.ts';
import { catchPlanFeatureError } from '../_shared/planEntitlements.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('social-inbox-templates', async (req) => {
  const body =
    req.method === 'GET' || req.method === 'DELETE'
      ? null
      : ((await readJsonBody(req)) as Record<string, unknown>);
  const capability =
    req.method === 'GET'
      ? 'quick_replies'
      : req.method === 'POST'
        ? 'quick_replies_add'
        : req.method === 'PATCH'
          ? 'quick_replies_edit'
          : req.method === 'DELETE'
            ? 'quick_replies_delete'
            : 'manage';
  const ctx = await resolveInboxAccess(req, capability, body);
  const sb = createServiceClient();

  if (req.method === 'POST' || req.method === 'PATCH') {
    try {
      await requireQuickRepliesPlan(ctx);
    } catch (err) {
      const planErr = catchPlanFeatureError(req, err);
      if (planErr) return planErr;
      throw err;
    }
  }

  if (req.method === 'GET') {
    await seedDefaultInboxQuickRepliesIfEmpty(ctx.orgId, ctx.parkingId);
    const listQuery = sb
      .from('social_reply_templates')
      .select('*')
      .eq('organization_id', ctx.orgId)
      .eq('is_active', true);
    const { data, error } = await (
      ctx.parkingId ? listQuery.eq('parking_id', ctx.parkingId) : listQuery.is('parking_id', null)
    ).order('sort_order', { ascending: true });
    if (error) return jsonError(req, error.message, 500);
    return jsonSuccess(req, { templates: data ?? [] });
  }

  if (req.method === 'POST') {
    const title = String(body?.title ?? '').trim();
    const bodyText = String(body?.bodyText ?? body?.body_text ?? '').trim();
    if (!title || !bodyText) {
      return jsonError(req, 'title and bodyText required', 400);
    }
    try {
      const template = await createQuickReplyTemplate(ctx, {
        title,
        bodyText,
        platform: body?.platform,
        conversationType: body?.conversationType,
        sortOrder: body?.sortOrder,
      });
      return jsonSuccess(req, { template });
    } catch (err) {
      return jsonError(req, err instanceof Error ? err.message : 'Create failed', 500);
    }
  }

  if (req.method === 'PATCH') {
    const id = String(body?.id ?? '').trim();
    if (!id) return jsonError(req, 'id required', 400);
    try {
      const template = await updateQuickReplyTemplate(ctx, id, body ?? {});
      return jsonSuccess(req, { template });
    } catch (err) {
      return jsonError(req, err instanceof Error ? err.message : 'Update failed', 500);
    }
  }

  if (req.method === 'DELETE') {
    const url = new URL(req.url);
    const id = url.searchParams.get('id')?.trim();
    if (!id) return jsonError(req, 'id required', 400);
    try {
      await deleteQuickReplyTemplate(ctx, id);
      return jsonSuccess(req, { deleted: true });
    } catch (err) {
      return jsonError(req, err instanceof Error ? err.message : 'Delete failed', 500);
    }
  }

  return jsonError(req, 'Method not allowed', 405);
});
