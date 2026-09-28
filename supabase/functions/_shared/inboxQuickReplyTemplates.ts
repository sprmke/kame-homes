/**
 * Guest Inbox quick-reply template writes — shared by `social-inbox-templates` and the
 * assistant's `propose_manage_quick_reply_template`. Callers resolve inbox access first
 * (`resolveInboxAccess` with the matching quick_replies_* capability).
 */

import { createServiceClient } from './orgAuth.ts';
import { requireOrgPropertyFeature, requirePropertyFeature } from './planEntitlements.ts';

export type QuickReplyScope = {
  orgId: string;
  propertyId: string | null;
  parkingId: string | null;
};

export const QUICK_REPLY_TITLE_MAX = 80;
export const QUICK_REPLY_BODY_MAX = 2000;

/** `quickReplies` plan gate for create / update (property plan, else the org's best plan). */
export async function requireQuickRepliesPlan(scope: QuickReplyScope): Promise<void> {
  if (scope.propertyId) await requirePropertyFeature(scope.propertyId, 'quickReplies');
  else await requireOrgPropertyFeature(scope.orgId, 'quickReplies');
}

export async function createQuickReplyTemplate(
  scope: QuickReplyScope,
  input: {
    title: string;
    bodyText: string;
    platform?: unknown;
    conversationType?: unknown;
    sortOrder?: unknown;
  }
) {
  const title = input.title.trim();
  const bodyText = input.bodyText.trim();
  if (!title || !bodyText) throw new Error('title and bodyText required');
  const { data, error } = await createServiceClient()
    .from('social_reply_templates')
    .insert({
      organization_id: scope.orgId,
      parking_id: scope.parkingId,
      title,
      body_text: bodyText,
      platform: input.platform ?? null,
      conversation_type: input.conversationType ?? 'all',
      sort_order: Number(input.sortOrder ?? 0),
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateQuickReplyTemplate(
  scope: QuickReplyScope,
  id: string,
  body: Record<string, unknown>
) {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === 'string') patch.title = body.title.trim();
  if (typeof body.bodyText === 'string') patch.body_text = body.bodyText.trim();
  if (typeof body.body_text === 'string') patch.body_text = body.body_text.trim();
  if (body.platform !== undefined) patch.platform = body.platform;
  if (body.conversationType !== undefined) patch.conversation_type = body.conversationType;
  if (body.sortOrder !== undefined) patch.sort_order = Number(body.sortOrder);
  if (body.isActive !== undefined) patch.is_active = Boolean(body.isActive);
  const { data, error } = await createServiceClient()
    .from('social_reply_templates')
    .update(patch)
    .eq('organization_id', scope.orgId)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteQuickReplyTemplate(scope: QuickReplyScope, id: string): Promise<void> {
  const { error } = await createServiceClient()
    .from('social_reply_templates')
    .delete()
    .eq('organization_id', scope.orgId)
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** Loads one template in scope (org + parking / property bucket) — null when absent. */
export async function loadQuickReplyTemplate(scope: QuickReplyScope, id: string) {
  let query = createServiceClient()
    .from('social_reply_templates')
    .select('id, title, body_text, parking_id')
    .eq('organization_id', scope.orgId)
    .eq('id', id);
  query = scope.parkingId ? query.eq('parking_id', scope.parkingId) : query.is('parking_id', null);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data as { id: string; title: string; body_text: string } | null;
}
