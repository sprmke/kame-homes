import {
  resolveCampaignPalette,
  type CampaignPalette,
} from '@/features/dashboard/marketing/lib/designBrandColors';
import { VIDEO_CATEGORY_LABELS } from '@/features/dashboard/marketing/lib/video/videoCategories';
import type { VideoMotionOverride } from '@/features/dashboard/marketing/lib/video/videoMotionProfiles';
import {
  fitVideoAiSceneDurations,
  type VideoAiCategory,
  type VideoFontPairingId,
  type VideoTemplateTokens,
} from '@/features/dashboard/marketing/lib/videoAiTokens';

/** Video category chip labels for the AI generate modal — adds "Custom" on top of the real
 * `VideoCategory` set used elsewhere (sidebar folders, hand-authored template categorization). */
export const VIDEO_AI_CATEGORY_LABELS: Record<VideoAiCategory, string> = {
  ...VIDEO_CATEGORY_LABELS,
  custom: 'Custom',
};

export type VideoAiSuggestion = {
  id: string;
  title: string;
  summary: string;
  prompt: string;
  /** Look/mood colors — applied to the generated video palette (not brand teal). */
  mood: { from: string; to: string };
  /** Roughly how many scenes this vibe implies — drives the preview pacing bars only. */
  sceneHint: number;
  /** Soft locks applied when this suggestion is picked (host can still change Look controls). */
  lookLocks?: {
    motionMood?: 'calm' | 'energetic' | 'cinematic';
    fontPairing?: VideoFontPairingId;
  };
};

/** Featured count shown before "View more" in the generate modal. */
export const VIDEO_AI_SUGGESTIONS_PREVIEW_COUNT = 4;

/**
 * Pure look/motion vibes — deliberately independent of Category (Content). A host picks
 * *what* the video is about via Category/Content, and *how it looks* here, same split as
 * the Design tab's suggestions.
 */
export const VIDEO_AI_SUGGESTIONS: VideoAiSuggestion[] = [
  {
    id: 'slow-pans-soft-light',
    title: 'Slow Pans & Soft Light',
    summary: 'Gentle Ken Burns · airy scrims · calm close',
    mood: { from: '#f3ede2', to: '#d9c9b3' },
    sceneHint: 4,
    lookLocks: { motionMood: 'calm', fontPairing: 'editorial-serif' },
    prompt:
      'Quiet editorial look: slow gentle zooms and drifts, airy soft scrims, generous breathing room between beats, calm unhurried pace, elegant serif type',
  },
  {
    id: 'golden-hour-drift',
    title: 'Golden Hour Drift',
    summary: 'Warm light · drifting pans · romantic fade',
    mood: { from: '#f0c56a', to: '#b8622a' },
    sceneHint: 4,
    lookLocks: { motionMood: 'calm', fontPairing: 'cinematic-serif' },
    prompt:
      'Golden hour cinematography: warm amber light, slow drifting pans, soft romantic fades between beats, intimate unhurried mood, elegant serif type',
  },
  {
    id: 'punch-in-energy',
    title: 'Punch-In Energy',
    summary: 'Fast punch-in zooms · bold cuts · high contrast',
    mood: { from: '#f0806a', to: '#7a2030' },
    sceneHint: 4,
    lookLocks: { motionMood: 'energetic', fontPairing: 'modern-sans' },
    prompt:
      'High-energy edit: punchy zoom-in hooks, fast hard cuts, bold high-contrast type, quick confident pacing, scroll-stopping social energy',
  },
  {
    id: 'clockwipe-countdown',
    title: 'Clockwipe Countdown',
    summary: 'Clock-wipe transitions · ticking urgency · tight cuts',
    mood: { from: '#e8c56a', to: '#2a2a35' },
    sceneHint: 3,
    lookLocks: { motionMood: 'energetic', fontPairing: 'modern-sans' },
    prompt:
      'Countdown-style edit: clock-wipe and push-cut transitions between beats, tight urgent pacing that feels like a ticking clock, bold modern sans type',
  },
  {
    id: 'cinematic-sweep',
    title: 'Cinematic Sweep',
    summary: 'Wide pans · moody reveal · editorial serif',
    mood: { from: '#3a4a5c', to: '#0f1a24' },
    sceneHint: 4,
    lookLocks: { motionMood: 'cinematic', fontPairing: 'cinematic-serif' },
    prompt:
      'Cinematic wide pans left and right, moody slow reveal of the space, deep confident color, editorial serif headline, deliberate unhurried cuts',
  },
  {
    id: 'warm-closeup-hold',
    title: 'Warm Close-Up Hold',
    summary: 'Still holds · intimate framing · soft close',
    mood: { from: '#e8b0a8', to: '#7a3a42' },
    sceneHint: 4,
    lookLocks: { motionMood: 'calm', fontPairing: 'warm-serif' },
    prompt:
      'Warm intimate framing: still hold shots, gentle soft fades, close and personal feel, tender unhurried close, rounded friendly type',
  },
  {
    id: 'quiet-hold-fade',
    title: 'Quiet Hold & Fade',
    summary: 'Minimal motion · soft fades · understated close',
    mood: { from: '#c8d4c0', to: '#5a6e52' },
    sceneHint: 3,
    lookLocks: { motionMood: 'calm', fontPairing: 'editorial-serif' },
    prompt:
      'Minimal-motion edit: mostly still holds, soft cross-fades, quiet understated pacing, generous negative space, refined restrained type',
  },
  {
    id: 'diagonal-drift-glow',
    title: 'Diagonal Drift Glow',
    summary: 'Diagonal drifts · festive warm glow · soft wipes',
    mood: { from: '#e8a860', to: '#c45a4a' },
    sceneHint: 4,
    lookLocks: { motionMood: 'cinematic', fontPairing: 'warm-serif' },
    prompt:
      'Festive warm glow: diagonal drifting pans, soft wipe transitions, cozy golden color, inviting celebratory mood, warm rounded type',
  },
];

export type VideoAiDurationOption = {
  value: 'auto' | 8 | 10 | 12 | 15 | 20 | 25;
  label: string;
  hint: string;
  /** Target total runtime in seconds — null lets the AI's own total stand (still floored). */
  seconds: number | null;
};

export type VideoAiFontOption = {
  value: VideoFontPairingId | 'auto';
  label: string;
  hint: string;
  sample: string;
  fontFamily: string;
};

export type VideoAiMotionOption = {
  value: 'auto' | 'calm' | 'energetic' | 'cinematic';
  label: string;
  hint: string;
  preview: 'auto' | 'calm' | 'energetic' | 'cinematic';
};

/** Floor applied whenever the host leaves Duration on Auto — never a too-short clip. */
export const VIDEO_AI_DEFAULT_TARGET_SECONDS = 12;

export const VIDEO_AI_DURATION_OPTIONS: VideoAiDurationOption[] = [
  { value: 'auto', label: 'Auto', hint: '~12s', seconds: null },
  { value: 8, label: '8s', hint: 'Quick', seconds: 8 },
  { value: 10, label: '10s', hint: 'Standard', seconds: 10 },
  { value: 12, label: '12s', hint: 'Standard+', seconds: 12 },
  { value: 15, label: '15s', hint: 'Extended', seconds: 15 },
  { value: 20, label: '20s', hint: 'Long', seconds: 20 },
  { value: 25, label: '25s', hint: 'Max', seconds: 25 },
];

export const VIDEO_AI_FONT_OPTIONS: VideoAiFontOption[] = [
  {
    value: 'auto',
    label: 'Auto',
    hint: 'AI picks',
    sample: 'Aa',
    fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
  },
  {
    value: 'editorial-serif',
    label: 'Editorial',
    hint: 'Fraunces',
    sample: 'Aa',
    fontFamily: 'Fraunces, Georgia, serif',
  },
  {
    value: 'cinematic-serif',
    label: 'Cinematic',
    hint: 'Cormorant',
    sample: 'Aa',
    fontFamily: 'Cormorant Garamond, Georgia, serif',
  },
  {
    value: 'modern-sans',
    label: 'Modern',
    hint: 'Space Grotesk',
    sample: 'Aa',
    fontFamily: 'Space Grotesk, Plus Jakarta Sans, sans-serif',
  },
  {
    value: 'warm-serif',
    label: 'Warm',
    hint: 'Lora',
    sample: 'Aa',
    fontFamily: 'Lora, Georgia, serif',
  },
];

export const VIDEO_AI_MOTION_OPTIONS: VideoAiMotionOption[] = [
  { value: 'auto', label: 'Auto', hint: 'AI picks', preview: 'auto' },
  { value: 'calm', label: 'Calm', hint: 'Slow Ken Burns', preview: 'calm' },
  { value: 'energetic', label: 'Energetic', hint: 'Punchy cuts', preview: 'energetic' },
  { value: 'cinematic', label: 'Cinematic', hint: 'Sweeping pans', preview: 'cinematic' },
];

export const VIDEO_AI_MOTION_MOOD_POOLS: Record<
  'calm' | 'energetic' | 'cinematic',
  VideoMotionOverride[]
> = {
  calm: ['slow-zoom-in', 'hold', 'drift-up'],
  energetic: ['punch-in', 'zoom-out', 'diagonal-drift'],
  cinematic: ['pan-left', 'pan-right', 'slow-zoom-in'],
};

export const VIDEO_AI_DEFAULT_CONTENTS: Record<VideoAiCategory, string> = {
  'soft-stay': 'A calm, editorial welcome moment that sells the feeling of staying here.',
  'flash-deal': 'A limited-time discount with urgency to book direct.',
  'last-openings': 'The last remaining open dates this month, encouraging a quick booking.',
  reviews: 'A warm guest-love moment that builds trust in the property.',
  'fully-booked': 'A fully booked announcement that invites guests to join a waitlist.',
  seasonal: 'A seasonal moment tied to the time of year that invites a booking.',
  custom: '',
};

export type VideoAiGeneratePreferences = {
  duration: VideoAiDurationOption['value'];
  fontPairing: VideoFontPairingId | 'auto';
  motionMood: VideoAiMotionOption['value'];
  category: VideoAiCategory;
  content: string;
  /** From a Look suggestion — stamps the generated video's accent/cream palette. */
  lookMood?: { from: string; to: string };
};

export const DEFAULT_VIDEO_AI_PREFERENCES: VideoAiGeneratePreferences = {
  duration: 'auto',
  fontPairing: 'auto',
  motionMood: 'auto',
  category: 'soft-stay',
  content: VIDEO_AI_DEFAULT_CONTENTS['soft-stay'],
};

/** Map a Look suggestion mood gradient onto the Quiet Coast campaign palette. */
export function campaignPaletteFromLookMood(mood: { from: string; to: string }): CampaignPalette {
  const base = resolveCampaignPalette(undefined, {
    preservePresetPalette: true,
    presetAccent: mood.to,
  });
  return {
    ...base,
    cream: mood.from,
  };
}

/** Apply host style locks after AI returns (Auto leaves AI's choice, still floored). */
export function applyVideoAiPreferencesToTokens(
  tokens: VideoTemplateTokens,
  preferences: VideoAiGeneratePreferences
): VideoTemplateTokens {
  const durationOption = VIDEO_AI_DURATION_OPTIONS.find(
    (option) => option.value === preferences.duration
  );
  const currentTotal = tokens.scenes.reduce((sum, scene) => sum + scene.durationSec, 0);
  // Explicit picks are honored exactly (stretch or trim); Auto only ever stretches up to
  // the floor — a storyboard that's already generous is left alone.
  const targetSeconds =
    durationOption?.seconds ?? Math.max(currentTotal, VIDEO_AI_DEFAULT_TARGET_SECONDS);
  const scenes = fitVideoAiSceneDurations(tokens.scenes, targetSeconds);

  const moodPool =
    preferences.motionMood !== 'auto' ? VIDEO_AI_MOTION_MOOD_POOLS[preferences.motionMood] : null;
  const scenesWithMotion = moodPool
    ? scenes.map((scene, index) => ({ ...scene, motion: moodPool[index % moodPool.length]! }))
    : scenes;

  return {
    ...tokens,
    scenes: scenesWithMotion,
    fontPairing: preferences.fontPairing === 'auto' ? tokens.fontPairing : preferences.fontPairing,
    category: preferences.category,
  };
}
