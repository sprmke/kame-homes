/**
 * Flash-Lite tool-calling turn for guest web/Meta auto-reply and host Suggest preview.
 * Up to MAX_ROUNDS rounds, every tool call in a round runs (not just the first), and every
 * gathered tool result — not just the last — grounds the safety guard and the reply's rich card.
 *
 * docs/workflow/in-progress/agentic-ai-assistants.md (Phase 5, guest receptionist).
 */

import { withToolTimeout } from './ai/agent/toolTimeout.ts';
import type { AiFeature } from './aiModelRouter.ts';
import { generateWithTools, type GeminiContent, type GeminiContentPart } from './ai/llmTools.ts';
import {
  buildGuestReceptionistTurnPrompt,
  GUEST_RECEPTIONIST_TURN_PROMPT,
} from './ai/prompts/guestReceptionist.ts';
import { assertOrgAndPropertyAiQuota, type AiActorType } from './aiUsageService.ts';
import {
  getDashboardAssistantGlobalSettings,
  getDashboardAssistantOrgSettings,
  resolveDashboardAssistantKillSwitch,
} from './dashboardAssistantSettings.ts';
import { buildAiGroundingFacts } from './inboxAiGuestContext.ts';
import { AI_SUGGEST_FALLBACK_REPLY, assertSafeGuestReply } from './inboxAiSafetyGuard.ts';
import { createServiceClient } from './orgAuth.ts';
import {
  executeGuestReceptionistTool,
  flattenGuestRichReply,
  GUEST_RECEPTIONIST_TOOL_DECLARATIONS,
  GUEST_RECEPTIONIST_TOOL_NAMES,
  GUEST_WRITE_TOOLS,
  parseGuestRelativePriceAsk,
  serializeGuestRichCard,
  type GuestReceptionistToolName,
  type GuestReceptionistToolResult,
} from './guestReceptionistTools.ts';

const MAX_ROUNDS = 4;
/** A guest turn rarely needs more than 2-3 tool calls; this just bounds a pathological round. */
const MAX_TOOL_CALLS_PER_ROUND = 4;

/** Shown to the guest when `handoff_to_host` fires — always non-empty, never a bare tool result. */
export const GUEST_HANDOFF_FALLBACK_REPLY =
  "I'll get a member of our team to help you with that — they'll follow up with you shortly. You can also message them directly now.";

export type GuestReceptionistTurnResult = {
  suggestion: string;
  flagged: boolean;
  /** `handoff_to_host` fired this turn — caller should patch the conversation's AI-handoff state. */
  handoffRequested?: boolean;
  handoffReason?: string | null;
};

export type GuestReceptionistTurnInput = {
  orgId: string;
  /** Lets a guest-write tool (e.g. request_booking_inquiry) link its row to this inbox thread. */
  conversationId?: string | null;
  platform: string;
  conversationType: string;
  participantName: string | null;
  messages: Array<{ direction: string; body: string | null; sentAt: string }>;
  systemPromptOverride?: string | null;
  actorUserId?: string | null;
  actorType?: AiActorType;
  propertyId?: string | null;
  parkingId?: string | null;
  propertyName?: string | null;
  inquiryCheckIn?: string | null;
  inquiryCheckOut?: string | null;
  guestUserId?: string | null;
  feature?: Extract<AiFeature, 'inbox_auto_reply' | 'inbox_suggest'>;
};

function isGuestToolName(name: string): name is GuestReceptionistToolName {
  return (GUEST_RECEPTIONIST_TOOL_NAMES as readonly string[]).includes(name);
}

function isGuestToolCall(call: {
  name: string;
  arguments: Record<string, unknown>;
}): call is { name: GuestReceptionistToolName; arguments: Record<string, unknown> } {
  return isGuestToolName(call.name);
}

/**
 * Picks what goes into history as this round's model turn. Gemini's own `modelParts` carry the
 * real thought signature a later round needs ("Function call is missing a thought_signature" —
 * reproduced live), but only when every call Gemini made in the round is the one about to get a
 * functionResponse. If a non-guest-tool call or the per-round cap dropped any call, resending the
 * full, unfiltered modelParts would put a functionCall in history with no matching response, and
 * Gemini rejects the next round outright — so fall back to a synthetic reconstruction that is
 * guaranteed to match `calls` 1:1, even though it loses the real signature for this round.
 */
export function safeModelPartsForRound(
  modelParts: GeminiContentPart[] | undefined,
  rawToolCallCount: number,
  calls: readonly { name: string; arguments: Record<string, unknown> }[]
): GeminiContentPart[] {
  if (modelParts && modelParts.length > 0 && calls.length === rawToolCallCount) {
    return modelParts;
  }
  return calls.map((c) => ({ functionCall: { name: c.name, args: c.arguments } }));
}

/**
 * Tools offered this turn. A staff actor (host "Suggest") only ever produces a draft for a
 * human to review and send — it must never be able to hand a thread off or write anything on
 * the guest's behalf, so both are stripped before the model ever sees them. Phase 6's
 * `guest_actions` kill switch strips the same write tools for every actor when off.
 */
export function toolsFor(
  input: Pick<GuestReceptionistTurnInput, 'actorType'>,
  options?: { guestActionsEnabled?: boolean }
): typeof GUEST_RECEPTIONIST_TOOL_DECLARATIONS {
  const guestActionsEnabled = options?.guestActionsEnabled ?? true;
  if (input.actorType !== 'staff' && guestActionsEnabled) {
    return GUEST_RECEPTIONIST_TOOL_DECLARATIONS;
  }
  return GUEST_RECEPTIONIST_TOOL_DECLARATIONS.filter((tool) => {
    if (input.actorType === 'staff' && tool.name === 'handoff_to_host') return false;
    if (!guestActionsEnabled || input.actorType === 'staff') {
      return !GUEST_WRITE_TOOLS.has(tool.name as GuestReceptionistToolName);
    }
    return true;
  });
}

/**
 * Grounds the safety guard against every tool result gathered this turn, not only the last one
 * — a reply that cites an earlier tool's number or fact must not be flagged as ungrounded.
 */
export function aggregateGuardFacts(results: readonly GuestReceptionistToolResult[]): {
  factsText: string;
  pricingValues: number[];
} {
  const factsParts: string[] = [];
  const pricingValues: number[] = [];
  const collectNumbers = (text: string) => {
    for (const match of text.match(/\d+(?:\.\d+)?/g) ?? []) {
      const n = Number(match);
      if (Number.isFinite(n)) pricingValues.push(n);
    }
  };

  for (const tool of results) {
    factsParts.push(tool.spokenText);
    collectNumbers(tool.spokenText);
    factsParts.push(...tool.actions.map((a) => a.url));

    if (tool.richCard?.kind === 'map') {
      factsParts.push(tool.richCard.href);
    } else if (tool.richCard?.kind === 'checklist') {
      for (const item of tool.richCard.items) {
        factsParts.push(item);
        collectNumbers(item);
      }
    } else if (tool.richCard?.kind === 'table') {
      for (const row of tool.richCard.rows) {
        factsParts.push(row.join(' '));
        for (const cell of row) {
          const n = Number(String(cell).replace(/[^\d.]/g, ''));
          if (Number.isFinite(n) && n > 0) pricingValues.push(n);
        }
      }
    }
  }
  return { factsText: factsParts.filter(Boolean).join('\n'), pricingValues };
}

export async function runGuestReceptionistTurn(
  input: GuestReceptionistTurnInput
): Promise<GuestReceptionistTurnResult> {
  const feature = input.feature ?? 'inbox_auto_reply';
  // Checked once, up front, for the whole turn — every model call below passes
  // `quotaChecked: true` so a multi-round turn is never charged a redundant re-check.
  await assertOrgAndPropertyAiQuota(input.orgId, input.propertyId ?? null, feature);

  // Phase 6 kill switch: org override wins, else the platform-wide default applies.
  const [globalSettings, orgAssistantSettings] = await Promise.all([
    getDashboardAssistantGlobalSettings(),
    getDashboardAssistantOrgSettings(input.orgId),
  ]);
  const guestActionsEnabled = resolveDashboardAssistantKillSwitch(
    globalSettings.guestActionsEnabled,
    orgAssistantSettings.guestActionsEnabledOverride
  );

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

  let parkingFacts = '';
  if (input.parkingId) {
    try {
      const parking = await executeGuestReceptionistTool({
        name: 'get_parking_facts',
        args: {},
        propertyId: input.propertyId ?? null,
        parkingId: input.parkingId,
        guestUserId: input.guestUserId ?? null,
      });
      parkingFacts = `\nParking facts: ${parking.spokenText}`;
    } catch (err) {
      console.warn('[guestReceptionistTurn] parking facts:', err);
    }
  }

  const { system, user, latestGuestText } = buildGuestReceptionistTurnPrompt({
    orgName,
    systemPromptOverride: input.systemPromptOverride,
    factsText: `${grounding.factsText}${parkingFacts}`,
    platform: input.platform,
    conversationType: input.conversationType,
    participantName: input.participantName,
    propertyName: input.propertyName,
    inquiryCheckIn: input.inquiryCheckIn,
    inquiryCheckOut: input.inquiryCheckOut,
    messages: input.messages,
  });

  let history: GeminiContent[] = [{ role: 'user', parts: [{ text: user }] }];
  /** Every tool result gathered this turn, in call order — grounds the guard and the rich reply. */
  const gathered: GuestReceptionistToolResult[] = [];
  let text: string | null = null;
  let handoffRequested = false;
  let handoffTool: GuestReceptionistToolResult | null = null;

  const relativePrice = parseGuestRelativePriceAsk(latestGuestText);
  if (relativePrice && input.propertyId) {
    try {
      const priceResult = await executeGuestReceptionistTool({
        name: 'get_inquiry_price',
        args: relativePrice,
        propertyId: input.propertyId,
        parkingId: input.parkingId ?? null,
        guestUserId: input.guestUserId ?? null,
      });
      gathered.push(priceResult);
      if (priceResult.spokenText.trim()) text = priceResult.spokenText;
    } catch (err) {
      console.warn('[guestReceptionistTurn] relative price:', err);
    }
  }

  const tools = toolsFor(input, { guestActionsEnabled });
  for (let round = 0; !text && !handoffRequested && round < MAX_ROUNDS; round++) {
    const result = await generateWithTools({
      feature,
      prompt: GUEST_RECEPTIONIST_TURN_PROMPT,
      system,
      history,
      tools,
      toolMode: 'auto',
      temperature: 0.3,
      maxOutputTokens: 512,
      billing: {
        organizationId: input.orgId,
        propertyId: input.propertyId ?? null,
        actorUserId: input.actorUserId ?? null,
        actorType: input.actorType ?? 'system',
        quotaChecked: true,
      },
    });

    const calls = result.toolCalls.filter(isGuestToolCall).slice(0, MAX_TOOL_CALLS_PER_ROUND);
    if (calls.length === 0) {
      text = result.text?.trim() || null;
      break;
    }

    const modelParts = safeModelPartsForRound(result.modelParts, result.toolCalls.length, calls);
    const responseParts: GeminiContentPart[] = [];
    // Every call in the round runs — not just the first — so a model that asked for two
    // independent facts (e.g. price + stay-guide) in one round gets both answered.
    for (const call of calls) {
      let toolResult: GuestReceptionistToolResult;
      try {
        toolResult = await withToolTimeout(call.name, () =>
          executeGuestReceptionistTool({
            name: call.name,
            args: call.arguments,
            orgId: input.orgId,
            conversationId: input.conversationId ?? null,
            propertyId: input.propertyId ?? null,
            parkingId: input.parkingId ?? null,
            guestUserId: input.guestUserId ?? null,
          })
        );
      } catch (err) {
        console.warn('[guestReceptionistTurn] tool call failed:', call.name, err);
        responseParts.push({
          functionResponse: {
            name: call.name,
            response: {
              error: 'That could not be checked right now. Answer without it or hand off.',
            },
          },
        });
        continue;
      }
      gathered.push(toolResult);
      responseParts.push({
        functionResponse: {
          name: call.name,
          response: { spokenText: toolResult.spokenText, hasCard: Boolean(toolResult.richCard) },
        },
      });
      if (call.name === 'handoff_to_host') {
        handoffRequested = true;
        handoffTool = toolResult;
      }
    }

    history = [
      ...history,
      { role: 'model', parts: modelParts },
      { role: 'user', parts: responseParts },
    ];
  }

  if (handoffRequested) {
    text = handoffTool?.spokenText.trim() || GUEST_HANDOFF_FALLBACK_REPLY;
  } else if (!text) {
    text = gathered.at(-1)?.spokenText ?? '';
  }

  let richText = text;
  for (const tool of gathered) {
    if (tool.richCard) richText = serializeGuestRichCard(tool.richCard, richText);
  }
  const extra = aggregateGuardFacts(gathered);
  const flattened = flattenGuestRichReply(richText);

  const guard = assertSafeGuestReply({
    draftText: flattened,
    guestMessage: latestGuestText,
    allowedFacts: {
      pricingValues: [...grounding.guardContext.pricingValues, ...extra.pricingValues],
      allowedAccountNumbers: grounding.guardContext.allowedAccountNumbers,
      factsText: `${grounding.factsText}\n${extra.factsText}${parkingFacts}`,
    },
    participantName: input.participantName,
    otherGuestNames: grounding.guardContext.otherGuestNames,
  });

  if (!guard.safe) {
    console.warn('[guestReceptionistTurn] reply flagged:', guard.reason.split(':')[0]);
    return { suggestion: AI_SUGGEST_FALLBACK_REPLY, flagged: true };
  }

  const suggestion = input.platform === 'web' ? richText.trim() : flattened;
  if (!suggestion) return { suggestion: AI_SUGGEST_FALLBACK_REPLY, flagged: true };
  return {
    suggestion,
    flagged: false,
    ...(handoffRequested ? { handoffRequested: true, handoffReason: latestGuestText || null } : {}),
  };
}
