/**
 * Shared gate for AI auto-replies to guests (Meta DMs + web chat). Both channels send model
 * output with no human review, so every decision that keeps that safe lives here once:
 * host settings + per-platform toggle, plan entitlement, cooldown, a per-conversation AI budget
 * (inbound traffic is public, so one sender must not be able to drain the org's AI credits),
 * and the rule that a guard-flagged draft is never sent.
 */

import { isFeatureEnabled } from './planFeatures.ts';
import { orgHasPropertyWithFeature, resolvePropertyEntitlements } from './planEntitlements.ts';
import { checkRateLimit } from './rateLimit.ts';
import type { AiSuggestResult } from './socialInboxAiService.ts';
import { socialInboxDb } from './socialInboxDb.ts';

const AUTO_REPLY_COOLDOWN_MS = 90_000;
/** Max AI auto-replies per conversation per hour; above this the thread waits for the host. */
const AUTO_REPLY_PER_CONVERSATION_PER_HOUR = 10;

export type AutoReplySettings = { ai_system_prompt: string | null };

type AutoReplyMessage = {
  id: string;
  direction: string;
  is_ai_generated?: boolean | null;
  sent_at: string;
};

/** Org-level auto-reply settings when auto-send is on for this platform, otherwise null. */
export async function loadAutoReplySettings(
  orgId: string,
  platformToggleKey: string
): Promise<AutoReplySettings | null> {
  const { data: settings } = await socialInboxDb()
    .from('social_inbox_settings')
    .select('auto_reply_enabled, auto_reply_mode, platform_toggles, ai_system_prompt')
    .eq('organization_id', orgId)
    .is('parking_id', null)
    .maybeSingle();
  if (!settings?.auto_reply_enabled || settings.auto_reply_mode !== 'send') return null;
  const toggles = (settings.platform_toggles ?? {}) as Record<string, boolean>;
  if (toggles[platformToggleKey] === false) return null;
  return { ai_system_prompt: (settings.ai_system_prompt as string | null) ?? null };
}

export async function isAutoReplyEntitled(
  orgId: string,
  propertyId: string | null
): Promise<boolean> {
  if (propertyId) {
    return isFeatureEnabled(await resolvePropertyEntitlements(propertyId), 'aiChatAutoReply');
  }
  return orgHasPropertyWithFeature(orgId, 'aiChatAutoReply');
}

/** True when an AI reply went out recently and no new guest message has arrived since. */
export function isWithinAutoReplyCooldown(messages: AutoReplyMessage[], now = Date.now()): boolean {
  const recentAutoReply = [...messages]
    .reverse()
    .find(
      (m) =>
        m.direction === 'outbound' &&
        m.is_ai_generated &&
        now - new Date(m.sent_at).getTime() < AUTO_REPLY_COOLDOWN_MS
    );
  if (!recentAutoReply) return false;
  const autoIdx = messages.findIndex((m) => m.id === recentAutoReply.id);
  return !messages.slice(autoIdx + 1).some((m) => m.direction === 'inbound');
}

/** Consumes one slot of the per-conversation AI budget; false when the budget is spent. */
export async function consumeAutoReplyBudget(conversationId: string): Promise<boolean> {
  const decision = await checkRateLimit({
    scope: 'inbox-auto-reply',
    identity: `conv:${conversationId}`,
    limit: AUTO_REPLY_PER_CONVERSATION_PER_HOUR,
    windowSec: 3600,
  });
  return decision.allowed;
}

/**
 * A flagged draft is only ever the canned fallback line. Auto-sending it would promise a
 * follow-up and mark the thread `replied`, hiding it from the host — so it is never sent; the
 * thread stays pending and the inbound-message notification already alerts the host.
 */
export function isSendableAutoReply(result: AiSuggestResult): boolean {
  return !result.flagged && result.suggestion.trim().length > 0;
}
