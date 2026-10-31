/**
 * Prompt direction for Marketing Studio video (Veo 3.1)
 * (docs/workflow/for-testing/marketing-ai-video-quality.md).
 *
 * The final Veo prompt has two halves:
 *
 * 1. A shot description: camera move, subject, action, light. Written by one cheap
 *    Flash-Lite call that also *looks at* the start-frame photo when there is one, so
 *    it can pick believable motion for what is actually in the room (curtains, plants,
 *    water, light) instead of inventing things. Falls back to a deterministic sentence
 *    built from the same parts. Platform cost, never host credits (same as images).
 * 2. A fixed guardrail tail, always appended in code: style, platform framing, the
 *    "keep the room as photographed" rule, and the audio rule. The LLM never writes
 *    these, so it cannot drop them.
 *
 * Fail-open: enhancement failing, timing out, or being disabled never blocks a paid
 * generation.
 */

import { generateText, type LlmPart } from './ai/llmClient.ts';
import { isGeminiConfigured } from './ai/llmTransport.ts';
import { definePrompt } from './ai/prompt.ts';
import { withUntrustedDataRule, wrapUntrusted } from './ai/untrusted.ts';
import type { MarketingImagePropertyContext } from './marketingImagePromptBuilder.ts';

const FEATURE = 'marketing_video_prompt_enhance' as const;

export const VIDEO_PROMPT_ENHANCE_PROMPT = definePrompt({
  id: 'marketing_video_prompt_enhance',
  version: '2026-10-01.1',
});

/** Vision input makes this slower than the text-only image enhancement (8s). */
const ENHANCE_TIMEOUT_MS = 10_000;

/** Veo caps the prompt at 1,024 tokens (~4,000 chars). Leave headroom. */
const MAX_VEO_PROMPT_CHARS = 3_200;
const MAX_SHOT_DESCRIPTION_CHARS = 1_200;
const MAX_NEGATIVE_CHARS = 900;

/** Used when a host starts from a photo and leaves the description empty. */
export const VIDEO_PHOTO_DEFAULT_PROMPT = 'Bring this photo to life';

export const VIDEO_CAMERA_MOVE_IDS = [
  'push-in',
  'pull-back',
  'pan',
  'orbit',
  'rise',
  'walkthrough',
  'still',
] as const;
export type VideoCameraMoveId = (typeof VIDEO_CAMERA_MOVE_IDS)[number];
export const DEFAULT_VIDEO_CAMERA_MOVE: VideoCameraMoveId = 'push-in';

/**
 * Real-estate videography moves: slow, stabilized, short travel. With a start frame,
 * long travel forces Veo to invent rooms it has never seen, so every move stays close
 * to the photographed space.
 */
const CAMERA_MOVE_DIRECTION: Record<VideoCameraMoveId, string> = {
  'push-in':
    'Slow, steady dolly push-in toward the main subject, gimbal-stabilized at a constant speed, ending only a little closer than it began.',
  'pull-back':
    'Slow dolly pull-back that gently widens the frame, gimbal-stabilized, revealing only a little more of the same space.',
  pan: 'Slow, smooth horizontal pan from left to right across the space, level horizon, gimbal-stabilized.',
  orbit:
    'Slow arc shot that circles a few degrees around the main subject, with gentle parallax between foreground and background, gimbal-stabilized.',
  rise: 'Slow pedestal rise: the camera lifts smoothly upward while staying level, showing the space from a slightly higher vantage.',
  walkthrough:
    'Smooth forward gimbal glide at an unhurried walking pace, like a real-estate walkthrough, travelling only a short distance into the space.',
  still:
    'Locked-off tripod shot with no camera movement. Only natural ambient motion in the scene, such as curtains stirring, leaves swaying, water rippling, or light shifting softly.',
};

export const VIDEO_SOUND_MODES = ['ambient', 'music'] as const;
export type VideoSoundMode = (typeof VIDEO_SOUND_MODES)[number];
export const DEFAULT_VIDEO_SOUND: VideoSoundMode = 'ambient';

/** Veo always renders audio. Unprompted, it tends to add mumbled voices, so speech is always ruled out. */
const SOUND_DIRECTION: Record<VideoSoundMode, string> = {
  ambient:
    'Audio: soft, natural ambient sound that fits the scene, such as quiet room tone, a gentle breeze, or distant nature or city sounds. No speech, no voiceover, no dialogue, no singing, no music.',
  music:
    'Audio: calm, warm instrumental background music at a low volume over a soft ambient bed. No speech, no voiceover, no dialogue, no lyrics, no singing.',
};

const VIDEO_STYLE =
  'Photorealistic, high-end real-estate and hospitality videography. One continuous shot with no cuts or transitions. ' +
  'Smooth, slow, cinematic motion at a natural 24fps with realistic motion blur. Level verticals, true-to-life colors, ' +
  'natural light, crisp detail, no plastic or CGI look.';

const VIDEO_TEXT_RULE =
  'No on-screen text, captions, subtitles, logos, signage, or watermarks anywhere in the frame.';

const START_FRAME_FIDELITY =
  'Begin exactly on the provided photo. Keep the space exactly as photographed: same layout, furniture, materials, colors, and window view. ' +
  'Do not add, remove, or replace objects, and do not add people.';

const TEXT_ONLY_FIDELITY =
  'No people unless the request asks for them. Do not invent brand names or logos.';

const PLATFORM_FRAMING_BY_ASPECT: Record<string, string> = {
  '9:16':
    'Vertical 9:16 Instagram Reel or Story: keep the main subject in the center of the frame and leave the top and bottom of the frame visually calm for on-screen UI.',
  '16:9':
    'Horizontal 16:9 video for a feed post, Facebook, or YouTube: wide, balanced composition with the subject on a rule-of-thirds line.',
};

/** Veo's dedicated negative channel. Listed as nouns (Veo guidance: no "no"/"don't" here). */
const BASE_NEGATIVE =
  'on-screen text, captions, subtitles, watermark, logo, distorted or warped architecture, bending walls, ' +
  'morphing furniture, flicker, jittery handheld shake, fast motion, scene cuts, low resolution, blurry footage, ' +
  'cartoon, CGI render look, talking, voiceover';

const START_FRAME_NEGATIVE = 'people, faces, hands, new objects appearing';

export function isVideoCameraMove(value: unknown): value is VideoCameraMoveId {
  return (VIDEO_CAMERA_MOVE_IDS as readonly string[]).includes(value as string);
}

export function isVideoSoundMode(value: unknown): value is VideoSoundMode {
  return (VIDEO_SOUND_MODES as readonly string[]).includes(value as string);
}

export type VideoPromptInput = {
  prompt: string;
  cameraMove: VideoCameraMoveId;
  sound: VideoSoundMode;
  aspectRatio: string;
  property?: MarketingImagePropertyContext | null;
  /** True when the host's photo is sent as Veo's first frame (image-to-video). */
  hasStartFrame: boolean;
};

/** Guardrails appended to every prompt, enhanced or not. */
export function buildVideoGuardrailTail(
  input: Pick<VideoPromptInput, 'sound' | 'aspectRatio' | 'hasStartFrame'>
): string {
  return [
    VIDEO_STYLE,
    PLATFORM_FRAMING_BY_ASPECT[input.aspectRatio] ?? '',
    input.hasStartFrame ? START_FRAME_FIDELITY : TEXT_ONLY_FIDELITY,
    VIDEO_TEXT_RULE,
    SOUND_DIRECTION[input.sound],
  ]
    .filter(Boolean)
    .join(' ');
}

/** Host's negative words appended to the base list; the base list is never dropped. */
export function buildVideoNegativePrompt(
  hostNegative: string | null | undefined,
  hasStartFrame: boolean
): string {
  const parts = [BASE_NEGATIVE, hasStartFrame ? START_FRAME_NEGATIVE : null, hostNegative?.trim()];
  return parts.filter(Boolean).join(', ').slice(0, MAX_NEGATIVE_CHARS);
}

function describeVideoProperty(property: MarketingImagePropertyContext | null): string | null {
  if (!property) return null;
  const kind = property.type?.trim();
  const place = [property.residenceName, property.city].filter(Boolean).join(', ');
  const bits: string[] = [];
  if (kind && place) bits.push(`a ${kind.toLowerCase()} at ${place}`);
  else if (place) bits.push(`a vacation rental at ${place}`);
  else if (kind) bits.push(`a ${kind.toLowerCase()} vacation rental`);
  if (property.amenities.length > 0) {
    bits.push(`amenities include ${property.amenities.slice(0, 6).join(', ')}`);
  }
  if (bits.length === 0) return null;
  return `Property context (use only what fits this shot): ${bits.join('; ')}.`;
}

function joinPrompt(shot: string, tail: string): string {
  const room = MAX_VEO_PROMPT_CHARS - tail.length - 2;
  return `${shot.trim().slice(0, Math.max(0, room))}\n\n${tail}`;
}

function asSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** The prompt sent when enhancement is off or fails. */
export function buildStructuredVideoPrompt(input: VideoPromptInput): string {
  const shot = [
    CAMERA_MOVE_DIRECTION[input.cameraMove],
    input.hasStartFrame ? 'The scene is the provided photo of the space.' : null,
    asSentence(input.prompt),
    describeVideoProperty(input.property ?? null),
  ]
    .filter(Boolean)
    .join(' ');
  return joinPrompt(shot, buildVideoGuardrailTail(input));
}

export type EnhanceMarketingVideoPromptInput = VideoPromptInput & {
  organizationId: string;
  propertyId: string;
  startFrame?: { mimeType: string; data: string } | null;
  actorUserId?: string | null;
};

export type EnhanceMarketingVideoPromptResult = {
  /** Always populated; the structured prompt when enhancement did not run. */
  prompt: string;
  enhanced: boolean;
};

const ENHANCE_SYSTEM = withUntrustedDataRule(
  'You direct short marketing clips for vacation-rental listings. Write ONE shot description ' +
    'for the Veo video model, in flowing sentences, under 110 words. Cover, in this order: the camera ' +
    'move (use the given camera direction, do not change it), the subject and setting, what moves and how, ' +
    'and the light and mood. Motion must be slow, subtle, and physically believable. ' +
    'If a photo is attached it is the first frame: describe only what is visible in it, and give motion only ' +
    'to things actually present (curtains, plants, water, steam, light, a ceiling fan). Never add people, ' +
    'text, signage, logos, or objects. Do not describe audio, aspect ratio, or style rules; those are added ' +
    'separately. Output only the shot description, with no preamble, quotes, or labels.'
);

/**
 * Rewrites the host's request into a Veo shot description, grounded in the start
 * frame when there is one. Never throws.
 */
export async function enhanceMarketingVideoPrompt(
  input: EnhanceMarketingVideoPromptInput
): Promise<EnhanceMarketingVideoPromptResult> {
  const fallback = buildStructuredVideoPrompt(input);
  if (!isGeminiConfigured()) return { prompt: fallback, enhanced: false };

  const userText = [
    `Host's request:\n${wrapUntrusted('host_prompt', input.prompt.trim(), 500)}`,
    `Camera direction: ${CAMERA_MOVE_DIRECTION[input.cameraMove]}`,
    describeVideoProperty(input.property ?? null),
    input.startFrame
      ? 'The attached photo is the first frame of the clip.'
      : 'There is no photo; imagine a scene that fits the request.',
  ]
    .filter(Boolean)
    .join('\n');

  const user: LlmPart[] = input.startFrame
    ? [{ inlineData: input.startFrame }, { text: userText }]
    : [{ text: userText }];

  try {
    const result = await generateText({
      feature: FEATURE,
      prompt: VIDEO_PROMPT_ENHANCE_PROMPT,
      system: ENHANCE_SYSTEM,
      user,
      temperature: 0.5,
      attemptsPerKey: 1,
      timeoutMs: ENHANCE_TIMEOUT_MS,
      cache: {},
      billing: {
        organizationId: input.organizationId,
        propertyId: input.propertyId,
        actorUserId: input.actorUserId ?? null,
        actorType: 'staff',
        mode: 'platform',
      },
    });
    const shot = result.text.trim().slice(0, MAX_SHOT_DESCRIPTION_CHARS);
    if (!shot) return { prompt: fallback, enhanced: false };
    return { prompt: joinPrompt(shot, buildVideoGuardrailTail(input)), enhanced: true };
  } catch (err) {
    console.warn('[marketingVideoPromptBuilder] enhancement failed open:', (err as Error).message);
    return { prompt: fallback, enhanced: false };
  }
}
