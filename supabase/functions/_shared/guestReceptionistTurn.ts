/**
 * Flash-Lite tool-calling turn for guest web/Meta auto-reply and host Suggest preview.
 * ≤2 rounds, 1 tool call each. Output is guest-safe text plus at most one ChatRichBody card.
 */

import type { AiFeature } from './aiModelRouter.ts';
import { generateWithTools, type GeminiContent } from './ai/llmTools.ts';
import {
  buildGuestReceptionistTurnPrompt,
  GUEST_RECEPTIONIST_TURN_PROMPT,
} from './ai/prompts/guestReceptionist.ts';
import type { AiActorType } from './aiUsageService.ts';
import { buildAiGroundingFacts } from './inboxAiGuestContext.ts';
import { AI_SUGGEST_FALLBACK_REPLY, assertSafeGuestReply } from './inboxAiSafetyGuard.ts';
import { createServiceClient } from './orgAuth.ts';
import {
  executeGuestReceptionistTool,
  flattenGuestRichReply,
  GUEST_RECEPTIONIST_TOOL_DECLARATIONS,
  GUEST_RECEPTIONIST_TOOL_NAMES,
  parseGuestRelativePriceAsk,
  serializeGuestRichCard,
  type GuestReceptionistToolName,
  type GuestReceptionistToolResult,
} from './guestReceptionistTools.ts';

const MAX_ROUNDS = 2;

export type GuestReceptionistTurnResult = {
  suggestion: string;
  flagged: boolean;
};

export type GuestReceptionistTurnInput = {
  orgId: string;
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

function extraGuardFacts(tool: GuestReceptionistToolResult | null): {
  factsText: string;
  pricingValues: number[];
} {
  if (!tool) return { factsText: '', pricingValues: [] };
  const href = tool.richCard?.kind === 'map' ? tool.richCard.href : '';
  const factsText = [tool.spokenText, href, ...tool.actions.map((a) => a.url)]
    .filter(Boolean)
    .join('\n');
  const pricingValues: number[] = [];
  const matches = tool.spokenText.match(/\d+(?:\.\d+)?/g) ?? [];
  for (const match of matches) {
    const n = Number(match);
    if (Number.isFinite(n)) pricingValues.push(n);
  }
  if (tool.richCard?.kind === 'table') {
    for (const row of tool.richCard.rows) {
      for (const cell of row) {
        const n = Number(String(cell).replace(/[^\d.]/g, ''));
        if (Number.isFinite(n) && n > 0) pricingValues.push(n);
      }
    }
  }
  return { factsText, pricingValues };
}

export async function runGuestReceptionistTurn(
  input: GuestReceptionistTurnInput
): Promise<GuestReceptionistTurnResult> {
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
  let lastTool: GuestReceptionistToolResult | null = null;
  let text: string | null = null;

  const relativePrice = parseGuestRelativePriceAsk(latestGuestText);
  if (relativePrice && input.propertyId) {
    try {
      lastTool = await executeGuestReceptionistTool({
        name: 'get_inquiry_price',
        args: relativePrice,
        propertyId: input.propertyId,
        parkingId: input.parkingId ?? null,
        guestUserId: input.guestUserId ?? null,
      });
      if (lastTool.spokenText.trim()) text = lastTool.spokenText;
    } catch (err) {
      console.warn('[guestReceptionistTurn] relative price:', err);
    }
  }

  for (let round = 0; !text && round < MAX_ROUNDS; round++) {
    const result = await generateWithTools({
      feature: input.feature ?? 'inbox_auto_reply',
      prompt: GUEST_RECEPTIONIST_TURN_PROMPT,
      system,
      history,
      tools: GUEST_RECEPTIONIST_TOOL_DECLARATIONS,
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

    const call = result.toolCalls[0];
    if (call && isGuestToolName(call.name)) {
      lastTool = await executeGuestReceptionistTool({
        name: call.name,
        args: call.arguments,
        propertyId: input.propertyId ?? null,
        parkingId: input.parkingId ?? null,
        guestUserId: input.guestUserId ?? null,
      });
      history = [
        ...history,
        {
          role: 'model',
          parts: result.modelParts?.length
            ? result.modelParts
            : [{ functionCall: { name: call.name, args: call.arguments } }],
        },
        {
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: call.name,
                response: { spokenText: lastTool.spokenText },
              },
            },
          ],
        },
      ];
      continue;
    }

    text = result.text?.trim() || null;
    break;
  }

  if (!text) {
    text = lastTool?.spokenText ?? '';
  }
  const richText = serializeGuestRichCard(lastTool?.richCard, text);
  const extra = extraGuardFacts(lastTool);
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
  return { suggestion, flagged: false };
}
