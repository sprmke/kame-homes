/**
 * AI reply suggestions for social inbox — Gemini/Groq with org context.
 */

import { generateText } from './ai/llmClient.ts';
import { buildInboxReplyPrompt, INBOX_REPLY_PROMPT } from './ai/prompts/inboxReply.ts';
import { probeAiProviders } from './ai/providerHealth.ts';
import { assertOrgAndPropertyAiQuota, type AiActorType } from './aiUsageService.ts';
import { createServiceClient } from './orgAuth.ts';
import { buildAiGroundingFacts } from './inboxAiGuestContext.ts';
import { AI_SUGGEST_FALLBACK_REPLY, assertSafeGuestReply } from './inboxAiSafetyGuard.ts';

const INBOX_FEATURE = 'inbox_suggest' as const;

export type InboxAiProviderStatus = {
  available: boolean;
  geminiConfigured: boolean;
  groqConfigured: boolean;
  error: string | null;
};

/** Lightweight probe — used by automation settings to warn when auto-send cannot run. */
export async function checkInboxAiProviders(): Promise<InboxAiProviderStatus> {
  const health = await probeAiProviders();
  return {
    available: health.available,
    geminiConfigured: health.geminiConfigured,
    groqConfigured: health.groqConfigured,
    error: health.error,
  };
}

export type AiSuggestInput = {
  orgId: string;
  platform: string;
  conversationType: string;
  participantName: string | null;
  messages: Array<{ direction: string; body: string | null; sentAt: string }>;
  systemPromptOverride?: string | null;
  /** Who triggered this suggestion/reply, when known (unset for automated auto-reply). */
  actorUserId?: string | null;
  actorType?: AiActorType;
  propertyId?: string | null;
  propertyName?: string | null;
  inquiryCheckIn?: string | null;
  inquiryCheckOut?: string | null;
};

export type AiSuggestResult = {
  suggestion: string;
  flagged: boolean;
};

export async function suggestInboxReply(input: AiSuggestInput): Promise<AiSuggestResult> {
  const feature =
    input.platform === 'web' && input.conversationType === 'web_chat'
      ? ('inbox_auto_reply' as const)
      : INBOX_FEATURE;

  await assertOrgAndPropertyAiQuota(input.orgId, input.propertyId ?? null, feature);

  const sb = createServiceClient();
  const { data: orgRow } = await sb
    .from('organizations')
    .select('name, settings')
    .eq('id', input.orgId)
    .maybeSingle();
  const settings = (orgRow?.settings ?? {}) as Record<string, unknown>;
  const orgName =
    String(settings.contactName ?? '').trim() || String(orgRow?.name ?? '').trim() || 'our team';
  const grounding = await buildAiGroundingFacts(input.orgId, input.propertyId ?? null, {
    participantName: input.participantName,
    inquiryCheckIn: input.inquiryCheckIn ?? null,
    inquiryCheckOut: input.inquiryCheckOut ?? null,
    platform: input.platform,
  });
  const { system: systemPrompt, user: userPrompt, latestGuestText } = buildInboxReplyPrompt({
    orgName,
    systemPromptOverride: input.systemPromptOverride,
    factsText: grounding.factsText,
    platform: input.platform,
    conversationType: input.conversationType,
    participantName: input.participantName,
    propertyName: input.propertyName,
    inquiryCheckIn: input.inquiryCheckIn,
    inquiryCheckOut: input.inquiryCheckOut,
    messages: input.messages,
  });

  const guardReply = (draftText: string) =>
    assertSafeGuestReply({
      draftText,
      guestMessage: latestGuestText,
      allowedFacts: {
        pricingValues: grounding.guardContext.pricingValues,
        allowedAccountNumbers: grounding.guardContext.allowedAccountNumbers,
        factsText: grounding.factsText,
      },
      participantName: input.participantName,
      otherGuestNames: grounding.guardContext.otherGuestNames,
    });

  const result = await generateText({
    feature,
    prompt: INBOX_REPLY_PROMPT,
    system: systemPrompt,
    user: userPrompt,
    temperature: 0.5,
    // Only guard-approved replies are cached, so a cache hit is always safe to return.
    cache: { shouldStore: (text) => guardReply(text).safe },
    billing: {
      organizationId: input.orgId,
      propertyId: input.propertyId ?? null,
      actorUserId: input.actorUserId ?? null,
      actorType: input.actorType ?? (feature === 'inbox_auto_reply' ? 'system' : 'staff'),
      quotaChecked: true,
    },
  });
  if (result.cacheHit) return { suggestion: result.text, flagged: false };
  const draft = result.text;

  const guard = guardReply(draft);

  if (!guard.safe) {
    // Category only — the full reason can contain another guest's name.
    console.warn('[socialInboxAiService] reply flagged:', guard.reason.split(':')[0]);
    return { suggestion: AI_SUGGEST_FALLBACK_REPLY, flagged: true };
  }

  return { suggestion: draft, flagged: false };
}

/**
 * Instagram allows private replies to comments within 7 days of the comment.
 * After 7 days the `/{comment-id}/private_replies` endpoint rejects with OAuthException.
 * Public comment replies have no time limit.
 */
export function isWithinCommentPrivateReplyWindow(lastInboundAt: string | null): boolean {
  if (!lastInboundAt) return false;
  const sentAt = new Date(lastInboundAt);
  if (Number.isNaN(sentAt.getTime())) return false;
  const expiresAt = new Date(sentAt);
  expiresAt.setDate(expiresAt.getDate() + 7);
  return expiresAt.getTime() > Date.now();
}

export function isWithinHumanAgentWindowFromInbound(lastInboundAt: string | null): boolean {
  if (!lastInboundAt) return false;
  const sentAt = new Date(lastInboundAt);
  if (Number.isNaN(sentAt.getTime())) return false;
  const expiresAt = new Date(sentAt);
  expiresAt.setDate(expiresAt.getDate() + 7);
  return expiresAt.getTime() > Date.now();
}

export function isWithinMessagingWindow(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() > Date.now();
}

export function isWithinMessagingWindowFromInbound(lastInboundAt: string | null): boolean {
  if (!lastInboundAt) return false;
  const expires = new Date(lastInboundAt);
  expires.setHours(expires.getHours() + 24);
  return expires.getTime() > Date.now();
}
