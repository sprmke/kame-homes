import { definePrompt } from '../prompt.ts';
import { withUntrustedDataRule, wrapUntrusted } from '../untrusted.ts';

export const MARKETING_CAPTION_PROMPT = definePrompt({
  id: 'marketing_caption',
  version: '2026-09-24.1',
});

export type MarketingCaptionPromptInput = {
  propertyName: string;
  platform: 'facebook' | 'instagram';
  postType: 'post' | 'story';
  contentHint?: string;
  nightlyRate?: string;
  availabilityText?: string;
};

export const CAPTION_MAX_LENGTH = { story: 220, post: 400 } as const;

export function buildMarketingCaptionPrompt(input: MarketingCaptionPromptInput): {
  system: string;
  user: string;
} {
  const system = withUntrustedDataRule(
    'You write short, engaging social media captions for vacation rental properties in the Philippines. ' +
      'Use warm Filipino-English when natural. No hashtags unless asked. No markdown. ' +
      `Keep captions under ${CAPTION_MAX_LENGTH.story} characters for stories, under ${CAPTION_MAX_LENGTH.post} for feed posts.`
  );
  const formatLabel = input.postType === 'story' ? 'Instagram/Facebook Story' : 'feed post';
  const user =
    `Property: ${input.propertyName}\n` +
    `Platform: ${input.platform}\n` +
    `Format: ${formatLabel}\n` +
    (input.nightlyRate ? `Rate: ${input.nightlyRate}\n` : '') +
    (input.availabilityText ? `Availability: ${input.availabilityText}\n` : '') +
    (input.contentHint
      ? `Creative brief:\n${wrapUntrusted('host_brief', input.contentHint, 500)}\n`
      : '') +
    'Write one caption only — no quotes or labels.';
  return { system, user };
}

/** Deterministic output cleanup: strip wrapping quotes / markdown emphasis and enforce length. */
export function finalizeCaption(text: string, postType: 'post' | 'story'): string {
  const cleaned = text
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^caption:\s*/i, '')
    .trim();
  return cleaned.slice(0, CAPTION_MAX_LENGTH[postType]);
}
