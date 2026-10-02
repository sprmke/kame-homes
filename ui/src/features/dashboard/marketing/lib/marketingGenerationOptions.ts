import {
  IMAGE_MAX_REFERENCES_BY_TIER,
  IMAGE_SIZES_BY_TIER,
  type ImageSize,
} from '@/features/dashboard/marketing/lib/marketingGenerationPricing';
import type { MarketingGenerationTier } from '@/features/dashboard/marketing/lib/marketingGenerationTypes';

export type TierOption = {
  value: MarketingGenerationTier;
  label: string;
  hint: string;
};

export const PREMIUM_TIER_OPTION: TierOption = {
  value: 'premium',
  label: 'Premium',
  hint: 'Most detail',
};

export function imageTierOptions(allowPremium: boolean): TierOption[] {
  return allowPremium ? [...IMAGE_TIER_OPTIONS, PREMIUM_TIER_OPTION] : IMAGE_TIER_OPTIONS;
}

export function videoTierOptions(allowPremium: boolean): TierOption[] {
  return allowPremium ? [...VIDEO_TIER_OPTIONS, PREMIUM_TIER_OPTION] : VIDEO_TIER_OPTIONS;
}

export const IMAGE_TIER_OPTIONS: TierOption[] = [
  { value: 'draft', label: 'Draft', hint: 'Try ideas' },
  { value: 'standard', label: 'Standard', hint: 'Ready to post' },
];

export type AspectRatioOption = {
  value: string;
  label: string;
  hint: string;
  /** width / height, for the preview frame */
  ratio: number;
};

export const IMAGE_ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [
  { value: '1:1', label: 'Square', hint: 'Feed post', ratio: 1 },
  { value: '4:5', label: 'Portrait', hint: 'Feed post', ratio: 4 / 5 },
  { value: '9:16', label: 'Story', hint: 'Stories', ratio: 9 / 16 },
  { value: '16:9', label: 'Landscape', hint: 'Cover photo', ratio: 16 / 9 },
];

export const IMAGE_SIZE_LABELS: Record<ImageSize, string> = {
  '512px': 'Small',
  '1K': 'Medium',
  '2K': 'Large',
  '4K': 'Extra large',
};

export function imageSizeOptions(tier: MarketingGenerationTier): ImageSize[] {
  return [...IMAGE_SIZES_BY_TIER[tier]];
}

export function maxReferencesForTier(tier: MarketingGenerationTier): number {
  return IMAGE_MAX_REFERENCES_BY_TIER[tier];
}

/**
 * Looks — lighting and mood only, never a subject, so a look stacks on top of whatever
 * the host described instead of replacing it. Each carries tested photographic
 * direction (real-estate/hospitality conventions: level verticals, natural light,
 * styled-but-lived-in). Applied to images and video alike.
 */
export type GenerationLook = {
  id: string;
  title: string;
  prompt: string;
};

export const GENERATION_LOOKS: GenerationLook[] = [
  {
    id: 'golden-hour',
    title: 'Golden hour',
    prompt:
      'warm late-afternoon sunlight streaming in, long soft shadows, cozy and inviting, styled but lived-in',
  },
  {
    id: 'bright-airy',
    title: 'Bright and airy',
    prompt:
      'soft diffused morning daylight, clean minimal styling, light wood tones and white linens, calm and fresh',
  },
  {
    id: 'evening-glow',
    title: 'Evening glow',
    prompt: 'night-time, warm layered lamplight, dim ambient mood, relaxed and intimate',
  },
  {
    id: 'blue-hour',
    title: 'Blue hour',
    prompt:
      'just after sunset, city lights beginning to glow, cool ambient sky, warm interior light spilling out',
  },
  {
    id: 'rainy-cozy',
    title: 'Rainy and cozy',
    prompt:
      'rain-streaked window in frame, warm lamplight inside against gray daylight outside, cozy and intimate',
  },
  {
    id: 'editorial',
    title: 'Magazine',
    prompt:
      'wide establishing shot from a low, level angle, architectural composition, natural light, magazine-editorial feel',
  },
  {
    id: 'detail',
    title: 'Close-up',
    prompt:
      'close-up detail of styling and textures in soft directional sunlight, shallow depth of field',
  },
];

const LOOK_SEPARATOR = '\n\nStyle: ';

/** Longest suffix a look can add, so the description box leaves room for it. */
export const MAX_LOOK_SUFFIX_CHARS = Math.max(
  ...GENERATION_LOOKS.map((look) => LOOK_SEPARATOR.length + look.prompt.length)
);

/** The prompt sent to the server: the host's description, plus the look when one is picked. */
export function composeGenerationPrompt(description: string, lookId: string | null): string {
  const trimmed = description.trim();
  const look = GENERATION_LOOKS.find((item) => item.id === lookId);
  return look ? `${trimmed}${LOOK_SEPARATOR}${look.prompt}` : trimmed;
}

/** Inverse of `composeGenerationPrompt`, for Retry / Refine and gallery captions. */
export function splitGenerationPrompt(prompt: string): {
  description: string;
  look: GenerationLook | null;
} {
  const index = prompt.lastIndexOf(LOOK_SEPARATOR);
  if (index === -1) return { description: prompt, look: null };
  const suffix = prompt.slice(index + LOOK_SEPARATOR.length);
  const look = GENERATION_LOOKS.find((item) => item.prompt === suffix) ?? null;
  return look ? { description: prompt.slice(0, index), look } : { description: prompt, look: null };
}

/** Subject ideas shown while the description is empty. Short, host-language. */
export const IMAGE_SUBJECT_IDEAS: string[] = [
  'Living room with a view',
  'Bedroom ready for guests',
  'Pool deck with loungers',
  'Balcony and skyline',
  'Kitchen set for breakfast',
];

/**
 * Video tier options. Premium is hidden unless a super-admin enables it per property.
 */
export const VIDEO_TIER_OPTIONS: TierOption[] = [
  { value: 'draft', label: 'Draft', hint: 'Try ideas' },
  { value: 'standard', label: 'Standard', hint: 'Ready to post' },
];

/** Video only supports 16:9 or 9:16 (Veo's own limitation). 9:16 is the default — most
 *  marketing video ends up as a Reel or Story. */
export const VIDEO_ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [
  { value: '9:16', label: 'Story / Reel', hint: 'Instagram Reels, Stories', ratio: 9 / 16 },
  { value: '16:9', label: 'Landscape', hint: 'Feed video, YouTube', ratio: 16 / 9 },
];

export const VIDEO_RESOLUTION_LABELS: Record<'720p' | '1080p', string> = {
  '720p': 'Standard (720p)',
  '1080p': 'High (1080p)',
};

/** A video starts from one photo (Veo's first frame); other photos would be ignored. */
export const VIDEO_MAX_REFERENCES = 1;

/** Mirrors `VIDEO_PHOTO_DEFAULT_PROMPT` in `_shared/marketingVideoPromptBuilder.ts`. */
export const VIDEO_PHOTO_DEFAULT_PROMPT = 'Bring this photo to life';

/** Mirrors `VIDEO_CAMERA_MOVE_IDS` in `_shared/marketingVideoPromptBuilder.ts`. */
export const VIDEO_CAMERA_MOVES = [
  { id: 'push-in', title: 'Push in' },
  { id: 'pull-back', title: 'Pull back' },
  { id: 'pan', title: 'Pan' },
  { id: 'orbit', title: 'Orbit' },
  { id: 'rise', title: 'Rise' },
  { id: 'walkthrough', title: 'Walkthrough' },
  { id: 'still', title: 'Still' },
] as const;
export type VideoCameraMoveId = (typeof VIDEO_CAMERA_MOVES)[number]['id'];
export const DEFAULT_VIDEO_CAMERA_MOVE: VideoCameraMoveId = 'push-in';

export const VIDEO_SOUND_MODES = [
  { value: 'ambient', label: 'Ambient' },
  { value: 'music', label: 'Music' },
] as const;
export type VideoSoundMode = (typeof VIDEO_SOUND_MODES)[number]['value'];
export const DEFAULT_VIDEO_SOUND: VideoSoundMode = 'ambient';

export function isVideoCameraMove(value: unknown): value is VideoCameraMoveId {
  return VIDEO_CAMERA_MOVES.some((move) => move.id === value);
}

export function isVideoSoundMode(value: unknown): value is VideoSoundMode {
  return VIDEO_SOUND_MODES.some((mode) => mode.value === value);
}

/** What moves in the scene. The camera move is picked separately. */
export const VIDEO_SUBJECT_IDEAS: string[] = [
  'Curtains moving in a soft breeze',
  'Sunlight drifting across the room',
  'Pool water rippling in the sun',
  'City lights coming on at dusk',
];
