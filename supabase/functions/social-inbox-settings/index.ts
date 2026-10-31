/**
 * Inbox automation settings (AI auto-reply toggles) — org-scoped for property, parking-scoped for parking; property/parking manage ACL.
 */

import { ensureSocialInboxSettings, socialInboxDb } from '../_shared/socialInboxService.ts';
import { checkInboxAiProviders } from '../_shared/socialInboxAiService.ts';
import { resolveInboxAccess } from '../_shared/inboxAccess.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import {
  catchPlanFeatureError,
  patchEnablesInboxAutoSend,
  requireOrgPropertyFeature,
  requirePropertyFeature,
} from '../_shared/planEntitlements.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { logAssetActivity } from '../_shared/assetActivity.ts';

serveAuthenticated('social-inbox-settings', async (req, user) => {
  const body = req.method === 'GET' ? null : ((await readJsonBody(req)) as Record<string, unknown>);
  const ctx = await resolveInboxAccess(req, 'automation', body);
  await ensureSocialInboxSettings(ctx.orgId, ctx.parkingId);
  const sb = socialInboxDb();

  if (req.method === 'GET') {
    const getQuery = sb.from('social_inbox_settings').select('*').eq('organization_id', ctx.orgId);
    const { data } = await (
      ctx.parkingId ? getQuery.eq('parking_id', ctx.parkingId) : getQuery.is('parking_id', null)
    ).maybeSingle();
    const aiStatus = await checkInboxAiProviders();
    return jsonSuccess(req, {
      autoReplyEnabled: data?.auto_reply_enabled ?? false,
      autoReplyMode: data?.auto_reply_mode ?? 'draft',
      aiSystemPrompt: data?.ai_system_prompt ?? '',
      platformToggles: data?.platform_toggles ?? {},
      aiAvailable: aiStatus.available,
      aiError: aiStatus.error,
    });
  }

  if (req.method === 'PATCH') {
    const currentQuery = sb
      .from('social_inbox_settings')
      .select('auto_reply_enabled, auto_reply_mode')
      .eq('organization_id', ctx.orgId);
    const { data: current } = await (
      ctx.parkingId
        ? currentQuery.eq('parking_id', ctx.parkingId)
        : currentQuery.is('parking_id', null)
    ).maybeSingle();

    if (
      patchEnablesInboxAutoSend(body ?? {}, {
        auto_reply_enabled: current?.auto_reply_enabled,
        auto_reply_mode: current?.auto_reply_mode,
      })
    ) {
      try {
        if (ctx.propertyId) {
          await requirePropertyFeature(ctx.propertyId, 'aiChatAutoReply');
        } else {
          await requireOrgPropertyFeature(ctx.orgId, 'aiChatAutoReply');
        }
      } catch (err) {
        const planErr = catchPlanFeatureError(req, err);
        if (planErr) return planErr;
        throw err;
      }
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body?.autoReplyEnabled !== undefined) {
      patch.auto_reply_enabled = Boolean(body.autoReplyEnabled);
    }
    if (body?.autoReplyMode === 'draft' || body?.autoReplyMode === 'send') {
      patch.auto_reply_mode = body.autoReplyMode;
    }
    if (typeof body?.aiSystemPrompt === 'string') {
      patch.ai_system_prompt = body.aiSystemPrompt.trim() || null;
    }
    if (body?.platformToggles && typeof body.platformToggles === 'object') {
      patch.platform_toggles = body.platformToggles;
    }
    const updateQuery = sb
      .from('social_inbox_settings')
      .update(patch)
      .eq('organization_id', ctx.orgId);
    const { data, error } = await (
      ctx.parkingId
        ? updateQuery.eq('parking_id', ctx.parkingId)
        : updateQuery.is('parking_id', null)
    )
      .select('*')
      .single();
    if (error) return jsonError(req, error.message, 500);
    await logAssetActivity({
      req,
      user,
      action: 'inbox.settings_changed',
      organizationId: ctx.orgId,
      propertyId: ctx.propertyId ?? null,
      parkingId: ctx.parkingId ?? null,
      targetType: 'settings',
      targetId: ctx.parkingId ?? ctx.propertyId ?? ctx.orgId,
      metadata: {
        fields: Object.keys(patch).filter((k) => k !== 'updated_at'),
        auto_reply_enabled: patch.auto_reply_enabled,
        auto_reply_mode: patch.auto_reply_mode,
      },
    });
    const aiStatus = await checkInboxAiProviders();
    return jsonSuccess(req, {
      autoReplyEnabled: data.auto_reply_enabled,
      autoReplyMode: data.auto_reply_mode,
      aiSystemPrompt: data.ai_system_prompt ?? '',
      platformToggles: data.platform_toggles ?? {},
      aiAvailable: aiStatus.available,
      aiError: aiStatus.error,
    });
  }

  return jsonError(req, 'Method not allowed', 405);
});
