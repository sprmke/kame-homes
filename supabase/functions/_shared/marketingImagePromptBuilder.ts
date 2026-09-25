/**
 * Prompt enhancement for Marketing Studio image generation
 * (docs/workflow/in-progress/marketing-ai-image-quality-hardening.md, Phase 1–3).
 *
 * `generate-marketing-media` used to send the host's raw textarea text straight to
 * Gemini with no system framing, no property context, and no platform intent — this
 * module is what stands in between now. It does three things, cheaply, before the
 * expensive image call:
 *
 * 1. A fixed system instruction (`IMAGE_SYSTEM_INSTRUCTION`) that frames every
 *    generation as a photograph, not an illustration — free, no extra call.
 * 2. Platform framing from the aspect ratio the host already picked (`1:1` -> feed
 *    post composition, `9:16` -> Story/Reel safe margins) — free, no extra call.
 * 3. An LLM rewrite (`enhanceMarketingImagePrompt`) that expands the host's shorthand
 *    into a full scene description using property context, following Gemini's own
 *    prompting guidance (subject, setting, lighting, camera). This is the one call
 *    that costs anything (~$0.0002 on Flash-Lite), and it is billed as platform cost
 *    via `recordAiUsagePlatformOnly` — see "Decision 2" in the plan doc — never added
 *    to the job's `credits_consumed`.
 *
 * Fail-open by design: enhancement failing, timing out, or being disabled must never
 * block a paid image generation. Every call site falls back to the structured (but
 * unenhanced) prompt from `buildStructuredImagePrompt`.
 */

import { generateText } from './ai/llmClient.ts';
import { isGeminiConfigured } from './ai/llmTransport.ts';
import { definePrompt } from './ai/prompt.ts';
import { withUntrustedDataRule, wrapUntrusted } from './ai/untrusted.ts';
import { resolveAmenityLabels } from './publicPropertyAmenities.ts';

const FEATURE = 'marketing_image_prompt_enhance' as const;

export const IMAGE_PROMPT_ENHANCE_PROMPT = definePrompt({
  id: 'marketing_image_prompt_enhance',
  version: '2026-09-24.1',
});

/**
 * Cap so a slow enhancement call can never meaningfully delay a paid generation.
 * Originally 3s on an untested estimate ("~400-800ms") — live testing against the
 * real `gemini-3.1-flash-lite` endpoint measured 2.2s-4.6s for this exact system +
 * user prompt shape, so 3s was silently failing the enhancement on a large share of
 * genuinely healthy calls (caught via a live-key test session, not inferred). 8s
 * gives real headroom above the observed max while staying well under the image
 * call's own 45s timeout, so enhancement is never the reason a generation is slow.
 */
const ENHANCE_TIMEOUT_MS = 8_000;

/**
 * Sent as `systemInstruction` on the real image call (marketingImageGenerationAi.ts),
 * not on the enhancement call. Framed as direct instruction per Gemini 3 guidance
 * (direct beats persuasive), and enumerates the specific "plastic AI photo" failure
 * modes research and Google's own docs call out, so the model actively avoids them
 * rather than us hoping a good prompt alone is enough.
 */
export const IMAGE_SYSTEM_INSTRUCTION =
  'You compose photographs for short-term-rental social media marketing. ' +
  'Output must look like a real photo taken by a skilled property photographer: ' +
  'correct one-point or two-point perspective, level verticals, natural global ' +
  'illumination consistent between subject and background, visible material texture ' +
  '(fabric weave, wood grain, subtle film grain), and no plastic or waxy skin/surface ' +
  'sheen. Do not render distorted architecture, extra or malformed limbs, or gibberish ' +
  'text, signage, or watermarks anywhere in the frame. Never depict people other than ' +
  'those implied by the prompt itself, and never invent brand names or logos.';

export type MarketingImagePropertyContext = {
  name: string;
  type: string | null;
  city: string | null;
  residenceName: string | null;
  maxGuests: number | null;
  amenities: string[];
  brandColor: string | null;
};

export type ImagePlatformIntent = {
  /** Restates the aspect ratio in words the model already understands from training
   *  on real social platforms, since a bare "9:16" is geometry, not intent. */
  framing: string;
};

const PLATFORM_FRAMING_BY_ASPECT: Record<string, string> = {
  '1:1':
    'Composed as an Instagram feed post: square crop, key subject centered with even margins on all sides.',
  '4:5':
    'Composed as an Instagram feed post: portrait crop, key subject in the upper two-thirds so a caption can sit below.',
  '9:16':
    'Composed as an Instagram/Facebook Story or Reel: vertical frame, key subject centered, top and bottom eighths left visually quiet for UI overlays.',
  '16:9':
    'Composed as a landscape feed photo or cover image: horizontal frame, wide establishing composition.',
  '3:4': 'Composed as a portrait feed photo: vertical frame, subject filling most of the height.',
  '4:3':
    'Composed as a classic landscape photo: horizontal frame, balanced foreground and background.',
  '3:2':
    'Composed as a landscape photo print crop: horizontal frame, rule-of-thirds subject placement.',
  '2:3':
    'Composed as a portrait photo print crop: vertical frame, rule-of-thirds subject placement.',
  '5:4': 'Composed as a near-square landscape photo: horizontal frame, centered subject.',
  '21:9': 'Composed as an ultra-wide cover/banner image: panoramic horizontal frame.',
};

export function resolvePlatformIntent(aspectRatio: string): ImagePlatformIntent {
  return {
    framing:
      PLATFORM_FRAMING_BY_ASPECT[aspectRatio] ??
      'Composed for social media sharing: clear single subject, no distracting clutter at the edges of the frame.',
  };
}

/**
 * Amenities on `properties.settings` are `enabledAmenities` (catalog ids) plus
 * `customAmenities` (`{ id, name }`). There is no `settings.amenities` string list.
 * Labels only — ids like `pool` must not reach the image model.
 */
export function amenitiesFromPropertySettings(
  settings: Record<string, unknown> | null | undefined
): string[] {
  if (!settings) return [];
  const enabledRaw = settings.enabledAmenities;
  const enabled = Array.isArray(enabledRaw)
    ? enabledRaw.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0
      )
    : [];
  const customRaw = settings.customAmenities;
  const custom = Array.isArray(customRaw)
    ? customRaw.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return [];
        const id = (entry as { id?: unknown }).id;
        const name = (entry as { name?: unknown }).name;
        if (typeof id !== 'string' || typeof name !== 'string') return [];
        const trimmed = name.trim();
        if (!id.trim() || !trimmed) return [];
        return [{ id, name: trimmed }];
      })
    : [];
  return resolveAmenityLabels(enabled, custom);
}

function describeProperty(property: MarketingImagePropertyContext | null): string | null {
  if (!property) return null;
  const bits: string[] = [];
  const name = property.name.trim();
  const kind = property.type?.trim();
  const place = [property.residenceName, property.city].filter(Boolean).join(', ');
  const kindPhrase = kind ? `a ${kind.toLowerCase()} unit` : null;
  if (name && kindPhrase && place) bits.push(`${name}, ${kindPhrase} at ${place}`);
  else if (name && place) bits.push(`${name}, a unit at ${place}`);
  else if (name && kindPhrase) bits.push(`${name}, ${kindPhrase}`);
  else if (kindPhrase && place) bits.push(`${kindPhrase} at ${place}`);
  else if (place) bits.push(`a unit at ${place}`);
  else if (kindPhrase) bits.push(kindPhrase);
  else if (name) bits.push(name);
  if (property.maxGuests) bits.push(`sleeps up to ${property.maxGuests} guests`);
  if (property.amenities.length > 0) {
    bits.push(`property amenities include ${property.amenities.slice(0, 6).join(', ')}`);
  }
  const brandColor = property.brandColor?.trim();
  if (brandColor) {
    bits.push(`brand color ${brandColor} is a palette hint only, not a recolor of the scene`);
  }
  if (bits.length === 0) return null;
  return `Property context (use only what is relevant to this specific shot, do not force every detail in): ${bits.join('; ')}.`;
}

/**
 * Builds the prompt actually sent to the image model when enhancement is off, fails,
 * or times out. Still an improvement over the pre-Phase-1 behavior (bare host text)
 * because it always carries platform framing and, when available, property context —
 * the two pieces that cost nothing and never require a network call.
 */
export function buildStructuredImagePrompt(input: {
  prompt: string;
  aspectRatio: string;
  property?: MarketingImagePropertyContext | null;
}): string {
  const parts = [input.prompt.trim(), resolvePlatformIntent(input.aspectRatio).framing];
  const propertyLine = describeProperty(input.property ?? null);
  if (propertyLine) parts.push(propertyLine);
  return parts.filter(Boolean).join('\n\n');
}

export type EnhanceMarketingImagePromptInput = {
  organizationId: string;
  propertyId: string;
  prompt: string;
  aspectRatio: string;
  property?: MarketingImagePropertyContext | null;
  hasReferenceImages: boolean;
  actorUserId?: string | null;
};

export type EnhanceMarketingImagePromptResult = {
  /** The prompt to actually send to the image model. Always populated — falls back
   *  to buildStructuredImagePrompt on any failure, so callers never need their own
   *  fallback branch. */
  prompt: string;
  /** True only when the LLM rewrite ran and its output was used. */
  enhanced: boolean;
};

/**
 * Rewrites the host's shorthand into a full scene description. Fail-open: any error,
 * non-ok response, empty output, or timeout falls back to the structured prompt and
 * returns `enhanced: false` — it never throws, so a caller can await this unconditionally
 * without a try/catch of its own.
 */
export async function enhanceMarketingImagePrompt(
  input: EnhanceMarketingImagePromptInput
): Promise<EnhanceMarketingImagePromptResult> {
  const fallback = buildStructuredImagePrompt({
    prompt: input.prompt,
    aspectRatio: input.aspectRatio,
    property: input.property,
  });

  if (!isGeminiConfigured()) return { prompt: fallback, enhanced: false };

  const propertyLine = describeProperty(input.property ?? null);
  const platformLine = resolvePlatformIntent(input.aspectRatio).framing;

  const systemPrompt = withUntrustedDataRule(
    'You expand short image requests for a vacation-rental marketing tool into one ' +
    'detailed scene description for a photorealistic image model. Follow this shape: ' +
    'subject and action, setting, lighting, camera angle and lens, in flowing sentences ' +
    '(not a keyword list). Stay under 120 words. Do not invent people, brand names, or ' +
    "text to render. Do not contradict the host's request. Output only the finished " +
    'scene description, nothing else — no preamble, no quotes, no labels.'
  );

  const userPrompt = [
    `Host's request:\n${wrapUntrusted('host_prompt', input.prompt.trim(), 500)}`,
    platformLine,
    propertyLine,
    input.hasReferenceImages
      ? 'Reference images are attached separately for style/subject guidance — describe the scene, do not describe the reference images themselves.'
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  // Phase 6a: cache the enhancement, not the image — two hosts (or one host retrying) with the
  // exact same prompt/aspect/property/references get the same rewrite without a second call.
  try {
    const result = await generateText({
      feature: FEATURE,
      prompt: IMAGE_PROMPT_ENHANCE_PROMPT,
      system: systemPrompt,
      user: userPrompt,
      temperature: 0.6,
      // Fail-open + latency-critical: each key gets one attempt with its own timeout (a dead
      // first key must never starve a healthy second key), no same-key retry, no fallback.
      attemptsPerKey: 1,
      timeoutMs: ENHANCE_TIMEOUT_MS,
      cache: {},
      // Absorbed as platform cost, not host credits — "Decision 2" in the plan doc.
      billing: {
        organizationId: input.organizationId,
        propertyId: input.propertyId,
        actorUserId: input.actorUserId ?? null,
        actorType: 'staff',
        mode: 'platform',
      },
    });
    const text = result.text.trim();
    if (!text) return { prompt: fallback, enhanced: false };
    return { prompt: text, enhanced: true };
  } catch (err) {
    console.warn('[marketingImagePromptBuilder] enhancement failed open:', (err as Error).message);
    return { prompt: fallback, enhanced: false };
  }
}
