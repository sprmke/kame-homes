/**
 * Video project v2: a track-based timeline.
 *
 * - One `main` track at index 0: contiguous (magnetic) photo/video clips with optional
 *   transitions between them. Item `from` on this track is DERIVED from order, durations and
 *   transition overlaps (see `layoutMainTrack`); it is stored only for convenience.
 * - `overlay` tracks: picture-in-picture photos/videos at any time range.
 * - `text` tracks: text, CTA, slot chips and logo layers. These keep the proven
 *   `VideoSceneLayer` payload (position, typography, template look) so migrated templates
 *   render exactly like v1.
 * - `audio` tracks: music, voiceover and SFX clips.
 *
 * Tracks are ordered bottom to top; render order is array order (the web renderer ignores z-index).
 * Plan: docs/workflow/for-testing/marketing-video-editor-multitrack.md §5.1.
 */

import type { CampaignPalette } from '@/features/dashboard/marketing/lib/designBrandColors';
import type { VideoMotionOverride } from '@/features/dashboard/marketing/lib/video/videoMotionProfiles';
import type {
  VideoFormat,
  VideoSceneKind,
  VideoSceneLayer,
  VideoTransition,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import type { VideoOverlayMode } from '@/features/dashboard/marketing/lib/video/videoStoryboardRecipes';

export const VIDEO_V2_FPS = 30;

/** Mirrors `supabase/functions/_shared/marketingVideoProject.ts` (server-enforced on save). */
export const VIDEO_V2_LIMITS = {
  maxDurationFrames: 60 * VIDEO_V2_FPS,
  maxTracks: 10,
  maxItems: 150,
  /** Videos that may be visible at the same frame (preview and export decode cost). */
  maxVisibleVideos: 3,
  /** Shortest clip: 0.1 s. */
  minItemFrames: 3,
  /** Shortest project the Player accepts. */
  minProjectFrames: 2 * VIDEO_V2_FPS,
  /** Default length of a new still image, text or overlay clip. */
  defaultItemFrames: 3 * VIDEO_V2_FPS,
  /** Default main-track transition overlap (matches v1 `VIDEO_TRANSITION_FRAMES`). */
  transitionFrames: 15,
} as const;

export const VIDEO_PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export type VideoPlaybackRate = (typeof VIDEO_PLAYBACK_RATES)[number];

export type VideoTrackKind = 'main' | 'overlay' | 'text' | 'audio';

export type VideoTrack = {
  id: string;
  kind: VideoTrackKind;
  name?: string;
  /** Visual tracks only. */
  hidden?: boolean;
  /** Audio-capable tracks (audio, and video clips on main/overlay). */
  muted?: boolean;
  locked?: boolean;
  /** Sorted by `from`. */
  items: VideoItem[];
};

export type MediaSource = 'property' | 'library' | 'ai' | 'jamendo' | 'upload' | 'url';

export type MediaRef = {
  url: string;
  /** `marketing_media_assets.id` when the clip comes from the library. */
  assetId?: string | null;
  source: MediaSource;
  width?: number;
  height?: number;
  /** Source length for video and audio. */
  durationMs?: number;
  /** Poster frame for video clips (library grid, timeline thumb fallback). */
  posterUrl?: string | null;
};

/** Center-anchored placement in percent of the frame. */
export type VisualTransform = {
  x: number;
  y: number;
  /** Width as % of frame width; height follows the media aspect. */
  widthPct: number;
  rotation: number;
  opacity: number;
};

export type MediaAdjust = {
  /** CSS filter multipliers, 1 = unchanged. */
  brightness: number;
  contrast: number;
  saturation: number;
};

export type MediaCrop = { left: number; right: number; top: number; bottom: number };

export type ItemBase = {
  id: string;
  /** Frames from project start. */
  from: number;
  durationInFrames: number;
  label?: string;
  /** v1 scene kind, kept for the template typography resolver and CTA reveal. */
  sceneKind?: VideoSceneKind;
};

export type MediaItem = ItemBase & {
  type: 'image' | 'video';
  media: MediaRef;
  /** `cover` fills the box, `contain` letterboxes (blurred or solid background on main). */
  fit: 'cover' | 'contain';
  crop?: MediaCrop;
  /** Overlay placement. Main-track clips are always full frame. */
  transform: VisualTransform;
  /** Ken Burns override (images). */
  motion?: VideoMotionOverride;
  adjust?: MediaAdjust;
  /** Photo wash (main track). */
  overlay?: VideoOverlayMode;
  /** Main track only; overlaps the previous clip. */
  transitionIn?: { type: VideoTransition; durationInFrames: number };
  /** Video only. */
  trimBeforeFrames?: number;
  playbackRate?: VideoPlaybackRate;
  /** Source audio volume 0..1 (video only). */
  volume?: number;
  muted?: boolean;
};

export type TextAnimation =
  'none' | 'template' | 'fade' | 'slide-up' | 'pop' | 'typewriter' | 'rise';

export type LayerItem = ItemBase & {
  type: 'layer';
  /** Text, CTA, slot chips, logo or image-on-text-track. Same shape as v1 scene layers. */
  layer: VideoSceneLayer;
  animationIn?: { type: TextAnimation; durationInFrames: number };
  animationOut?: { type: TextAnimation; durationInFrames: number };
};

export type AudioItem = ItemBase & {
  type: 'audio';
  media: MediaRef;
  trimBeforeFrames?: number;
  volume: number;
  fadeInFrames?: number;
  fadeOutFrames?: number;
  loop?: boolean;
  title?: string;
  artist?: string;
  /** Jamendo track id. */
  trackId?: string;
};

export type VideoItem = MediaItem | LayerItem | AudioItem;

export type VideoProjectV2 = {
  version: 2;
  templateId: string;
  campaignCategory: string;
  format: VideoFormat;
  fps: number;
  palette?: CampaignPalette;
  sourceReviewId?: string | null;
  /** Shows behind letterboxed media. */
  background: { color: string; fill: 'color' | 'blur' };
  /** Bottom to top. `tracks[0]` is always the single `main` track. */
  tracks: VideoTrack[];
};

/** Which item kinds each track kind accepts. */
export function trackAccepts(kind: VideoTrackKind, item: VideoItem): boolean {
  switch (kind) {
    case 'main':
      return item.type === 'image' || item.type === 'video';
    case 'overlay':
      return item.type === 'image' || item.type === 'video';
    case 'text':
      return item.type === 'layer';
    case 'audio':
      return item.type === 'audio';
  }
}

export function isMediaItem(item: VideoItem): item is MediaItem {
  return item.type === 'image' || item.type === 'video';
}

export function isLayerItem(item: VideoItem): item is LayerItem {
  return item.type === 'layer';
}

export function isAudioItem(item: VideoItem): item is AudioItem {
  return item.type === 'audio';
}export const DEFAULT_VISUAL_TRANSFORM: VisualTransform = {
  x: 50,
  y: 50,
  widthPct: 100,
  rotation: 0,
  opacity: 1,
};export const DEFAULT_PROJECT_BACKGROUND: VideoProjectV2['background'] = {
  color: '#0f172a',
  fill: 'color',
};
