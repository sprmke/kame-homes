import type { CampaignPalette } from '@/features/dashboard/marketing/lib/designBrandColors';
import type { VideoMotionOverride } from '@/features/dashboard/marketing/lib/video/videoMotionProfiles';
import type { VideoOverlayMode } from '@/features/dashboard/marketing/lib/video/videoStoryboardRecipes';
import type { VideoSceneTextLayout } from '@/features/dashboard/marketing/lib/video/videoTextSlots';

export type VideoFormat = 'instagram-story' | 'instagram-post' | 'landscape';

export type VideoTransition =
  | 'none'
  | 'fade'
  | 'slide-left'
  | 'slide-up'
  | 'wipe'
  | 'dissolve'
  | 'flip'
  | 'clock-wipe'
  | 'zoom-in-out'
  | 'push-cut';

export type VideoSceneKind = 'photo' | 'promo' | 'slots' | 'cta';

export type VideoSceneTextFields = {
  headline: string;
  subheadline: string;
  promoLine: string;
  ctaLine: string;
  slotLabels: string[];
  rulesLine: string;
};

export type VideoLayerKind = 'background' | 'image' | 'logo' | 'text' | 'cta' | 'slots';

export type VideoTextStyle = 'headline' | 'subheadline' | 'promo' | 'body' | 'footer';

export type VideoLayerPosition = {
  x: number;
  y: number;
  align?: 'left' | 'center' | 'right';
};

export type VideoLayerTypography = {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  letterSpacing?: number;
  lineHeight?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  /** Text outline for readability on busy backgrounds */
  strokeColor?: string | null;
  strokeWidth?: number;
  shadow?: boolean;
  /** CTA pill fill */
  backgroundColor?: string | null;
};

export type VideoSceneLayer = {
  id: string;
  kind: VideoLayerKind;
  imageUrl?: string | null;
  mediaType?: 'image' | 'video';
  text?: string;
  lines?: string[];
  /** Role seed for the template font pairing — `typography` overrides it when set. */
  textStyle?: VideoTextStyle;
  typography?: VideoLayerTypography;
  position: VideoLayerPosition;
  /** Overlay image width as % of frame width */
  widthPct?: number;
};

/** Selected element in the editor — a layer id. */
export type VideoSceneElementId = string;

export type VideoScene = {
  id: string;
  kind: VideoSceneKind;
  label: string;
  durationSec: number;
  transition: VideoTransition;
  /** Overrides the template's camera motion for this scene only. */
  motion?: VideoMotionOverride;
  /** Quiet Coast photo wash — recipe default, host-overridable. */
  overlay?: VideoOverlayMode;
  imageUrl: string | null;
  /** Background clip media type (`imageUrl` holds the asset URL for both). */
  backgroundMediaType?: 'image' | 'video';
  /**
   * @deprecated Derived and write-only — kept so pre-layer saves still load.
   * Read `layers` instead; `persistSceneLayers()` rewrites this on every save.
   */
  texts: VideoSceneTextFields;
  /** Layer stack (background first, overlays on top) — the source of truth. */
  layers?: VideoSceneLayer[];
  /**
   * @deprecated Derived and write-only — kept so pre-layer saves still load.
   * Read `layers` instead; `persistSceneLayers()` rewrites this on every save.
   */
  textLayout?: VideoSceneTextLayout;
  /**
   * @deprecated Derived and write-only — kept so pre-layer saves still load.
   * Read `layers` instead; `persistSceneLayers()` rewrites this on every save.
   */
  hiddenElements?: string[];
};

export type VideoProjectMusicSource = 'jamendo' | 'upload' | 'url';

export type VideoProjectMusic = {
  url: string | null;
  volume: number;
  title?: string;
  artist?: string;
  source?: VideoProjectMusicSource;
  trackId?: string;
};

export type VideoProject = {
  version: 1;
  templateId: string;
  /** VideoCategory id (or legacy Design category string on old saves). */
  campaignCategory: string;
  format: VideoFormat;
  fps: number;
  scenes: VideoScene[];
  music?: VideoProjectMusic;
  /** Optional look palette (AI suggestion mood) — overrides brand-tinted template palette. */
  palette?: CampaignPalette;
  /** Marketing guest review id used to seed Guest love / Stay again copy. */
  sourceReviewId?: string | null;
};

export const VIDEO_TRANSITION_FRAMES = 15;

export const VIDEO_FPS = 30;

export const VIDEO_SCENE_DURATION = {
  min: 1,
  max: 12,
  default: 3,
} as const;

export const VIDEO_MUSIC_DEFAULT_VOLUME = 0.45;
