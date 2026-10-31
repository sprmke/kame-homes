/**
 * AI-assisted social captions for Marketing Content Studio (via the AI gateway).
 */

import { generateText } from './ai/llmClient.ts';
import {
  buildMarketingCaptionPrompt,
  finalizeCaption,
  MARKETING_CAPTION_PROMPT,
} from './ai/prompts/marketingCaption.ts';
import type { AiActorType } from './aiUsageService.ts';

export type MarketingCaptionInput = {
  organizationId: string;
  propertyId: string;
  propertyName: string;
  platform: 'facebook' | 'instagram';
  postType: 'post' | 'story';
  contentHint?: string;
  nightlyRate?: string;
  availabilityText?: string;
  actorUserId?: string | null;
  actorType?: AiActorType;
};

export async function generateMarketingCaption(input: MarketingCaptionInput): Promise<string> {
  const { system, user } = buildMarketingCaptionPrompt(input);
  const result = await generateText({
    feature: 'marketing_caption',
    prompt: MARKETING_CAPTION_PROMPT,
    system,
    user,
    temperature: 0.7,
    cache: {},
    billing: {
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      actorUserId: input.actorUserId ?? null,
      actorType: input.actorType ?? 'staff',
    },
  });
  return finalizeCaption(result.text, input.postType);
}
