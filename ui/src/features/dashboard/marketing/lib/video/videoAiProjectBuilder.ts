/**
 * AI-generated video storyboard compiler.
 * Converts `VideoTemplateTokens` into a fully editable `VideoProject` that
 * renders through the exact same Remotion composition path as hand-authored
 * templates (`VideoCompositions.tsx`) — no bespoke rendering logic here.
 */

import type { CampaignPalette } from '@/features/dashboard/marketing/lib/designBrandColors';
import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import {
  resolveDesignBindingMedia,
  pickBindingMediaAt,
} from '@/features/dashboard/marketing/lib/propertyBindingMedia';
import { VIDEO_FORMAT_DIMENSIONS } from '@/features/dashboard/marketing/lib/video/videoFormatDimensions';
import { DEFAULT_VIDEO_MUSIC } from '@/features/dashboard/marketing/lib/video/videoMusicPresets';
import {
  VIDEO_FPS,
  VIDEO_MUSIC_DEFAULT_VOLUME,
  type VideoFormat,
  type VideoProject,
  type VideoProjectMusic,
  type VideoScene,
  type VideoSceneKind,
  type VideoSceneTextFields,
  type VideoTransition,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import { createSceneId } from '@/features/dashboard/marketing/lib/video/videoProjectUtils';
import {
  createLayerId,
  defaultLayersForKind,
  getSceneLayers,
  persistSceneLayers,
} from '@/features/dashboard/marketing/lib/video/videoSceneLayers';
import type {
  VideoOverlayMode,
  VideoTextBeat,
} from '@/features/dashboard/marketing/lib/video/videoStoryboardRecipes';
import {
  normalizeVideoTemplateTokens,
  type VideoAiCategory,
  type VideoSceneToken,
  type VideoTemplateTokens,
} from '@/features/dashboard/marketing/lib/videoAiTokens';

type VideoAiRole = 'hook' | 'broll' | 'offer' | 'cta';

function resolveSceneRole(index: number, total: number, kind: VideoSceneKind): VideoAiRole {
  if (index === total - 1) return 'cta';
  if (index === 0) return 'hook';
  if (kind === 'promo' || kind === 'slots') return 'offer';
  return 'broll';
}

function beatsForRole(
  role: VideoAiRole,
  kind: VideoSceneKind,
  options: { includeCta: boolean; includePropertyName: boolean }
): VideoTextBeat[] {
  if (role === 'hook') return kind === 'slots' ? ['headline', 'slotLabels'] : ['headline'];
  if (role === 'broll') return [];
  if (role === 'offer') return kind === 'slots' ? ['slotLabels'] : ['subheadline', 'promoLine'];
  const beats: VideoTextBeat[] = [];
  if (options.includeCta) beats.push('ctaLine');
  if (options.includePropertyName) beats.push('rulesLine');
  return beats;
}

function overlayForRole(role: VideoAiRole, kind: VideoSceneKind): VideoOverlayMode {
  if (role === 'hook') return 'soft-scrim';
  if (role === 'broll') return 'none';
  if (role === 'offer') return kind === 'slots' ? 'soft-scrim' : 'bottom-band';
  return 'bottom-band';
}

function emptyTexts(): VideoSceneTextFields {
  return {
    headline: '',
    subheadline: '',
    promoLine: '',
    ctaLine: '',
    slotLabels: [],
    rulesLine: '',
  };
}

function textsForBeats(beats: VideoTextBeat[], source: VideoSceneTextFields): VideoSceneTextFields {
  const next = emptyTexts();
  for (const beat of beats) {
    if (beat === 'slotLabels') next.slotLabels = [...source.slotLabels];
    else next[beat] = source[beat];
  }
  return next;
}

function resolvedSlotLabels(tokens: VideoTemplateTokens, binding: DesignBinding): string[] {
  if (tokens.copy.slotLabels.length > 0) return tokens.copy.slotLabels;
  return binding.openSlots.slice(0, 3).map((slot) => `${slot.dateNum} · ${slot.dayName}`);
}

function withLogoLayer(scene: VideoScene, logoUrl: string): VideoScene {
  const layers = [
    ...getSceneLayers(scene),
    {
      id: createLayerId(),
      kind: 'logo' as const,
      imageUrl: logoUrl,
      widthPct: 28,
      position: { x: 50, y: 12, align: 'center' as const },
    },
  ];
  return persistSceneLayers(scene, layers);
}

type BuildSceneOptions = {
  includeCta: boolean;
  includePropertyName: boolean;
  includeOrgLogo: boolean;
  orgLogoUrl: string | null;
};

function buildAiScene(
  sceneToken: VideoSceneToken,
  index: number,
  total: number,
  copy: VideoSceneTextFields,
  background: { url: string | null; mediaType: 'image' | 'video' },
  options: BuildSceneOptions,
  templateId: string
): VideoScene {
  // The renderer always treats the final scene as the closing/CTA beat; any
  // earlier scene the model mislabeled "cta" falls back to a photo beat.
  const kind: VideoSceneKind =
    index === total - 1 ? 'cta' : sceneToken.kind === 'cta' ? 'photo' : sceneToken.kind;
  const role = resolveSceneRole(index, total, kind);
  const beats = beatsForRole(role, kind, options);
  const texts = textsForBeats(beats, copy);
  const overlay = overlayForRole(role, kind);
  // The opening scene never has an incoming transition, matching every
  // hand-authored storyboard recipe.
  const transition: VideoTransition = index === 0 ? 'none' : sceneToken.transition;

  const base: VideoScene = {
    id: createSceneId(),
    kind,
    label: role === 'hook' ? 'Hook' : role === 'cta' ? 'CTA' : role === 'offer' ? 'Offer' : 'Scene',
    durationSec: sceneToken.durationSec,
    transition,
    overlay,
    motion: sceneToken.motion,
    imageUrl: background.url,
    backgroundMediaType: background.mediaType,
    texts,
  };

  let scene = persistSceneLayers(
    base,
    defaultLayersForKind(kind, background.url, texts, templateId)
  );

  if (role === 'hook' && options.includeOrgLogo && options.orgLogoUrl) {
    scene = withLogoLayer(scene, options.orgLogoUrl);
  }

  return scene;
}

const VIDEO_AI_MUSIC_CUES: Record<VideoAiCategory, { title: string; artist: string }> = {
  'soft-stay': { title: 'Lofi Chillout Hip Hop Beat', artist: 'Joystock' },
  'flash-deal': { title: 'Upbeat', artist: 'Electronic' },
  'last-openings': { title: 'Pulse', artist: 'Cinematic' },
  reviews: { title: 'Acoustic', artist: 'Chill' },
  'fully-booked': { title: 'Ambient', artist: 'Piano' },
  seasonal: { title: 'Warm', artist: 'Indie' },
  custom: { title: 'Ambient', artist: 'Piano' },
};

export type ResolveAiGeneratedVideoOptions = {
  includePropertyPhoto?: boolean;
  orgLogoUrl?: string | null;
  includeOrgLogo?: boolean;
  includeCta?: boolean;
  includePropertyName?: boolean;
  /** Rotates which property photo lands on which scene — vary per saved format. */
  mediaOffset?: number;
  /** Look-suggestion palette stamped onto the project. */
  palette?: CampaignPalette;
};

/** Compile AI tokens into a fully editable VideoProject for one format. */
export function resolveAiGeneratedVideoProject(
  tokensInput: Partial<VideoTemplateTokens>,
  binding: DesignBinding,
  format: VideoFormat,
  options?: ResolveAiGeneratedVideoOptions
): VideoProject {
  const tokens = normalizeVideoTemplateTokens(tokensInput);
  const includePropertyPhoto = options?.includePropertyPhoto !== false;
  const includeCta = options?.includeCta !== false;
  const includePropertyName = options?.includePropertyName !== false;
  const includeOrgLogo = options?.includeOrgLogo !== false && Boolean(options?.orgLogoUrl?.trim());
  const mediaOffset = options?.mediaOffset ?? 0;

  const media = includePropertyPhoto
    ? resolveDesignBindingMedia({
        propertyMedia: binding.propertyMedia,
        propertyPhoto: binding.propertyPhoto,
      })
    : [];

  const templateId = `ai-${tokens.fontPairing}`;
  const total = tokens.scenes.length;
  const copy: VideoSceneTextFields = {
    headline: tokens.copy.headline,
    subheadline: tokens.copy.subheadline,
    promoLine: tokens.copy.promoLine,
    ctaLine: tokens.copy.ctaLine,
    slotLabels: resolvedSlotLabels(tokens, binding),
    rulesLine: tokens.copy.rulesLine || binding.propertyName,
  };
  const sceneOptions: BuildSceneOptions = {
    includeCta,
    includePropertyName,
    includeOrgLogo,
    orgLogoUrl: options?.orgLogoUrl ?? null,
  };

  const scenes = tokens.scenes.map((sceneToken, index) => {
    const background =
      media.length > 0
        ? pickBindingMediaAt(media, index + mediaOffset)
        : { url: null, mediaType: 'image' as const };
    return buildAiScene(sceneToken, index, total, copy, background, sceneOptions, templateId);
  });

  const cue = VIDEO_AI_MUSIC_CUES[tokens.category];
  const music: VideoProjectMusic = cue
    ? {
        title: cue.title,
        artist: cue.artist,
        source: 'jamendo',
        url: null,
        volume: VIDEO_MUSIC_DEFAULT_VOLUME,
      }
    : { ...DEFAULT_VIDEO_MUSIC };

  return {
    version: 1,
    templateId,
    campaignCategory: tokens.category,
    format,
    fps: VIDEO_FPS,
    scenes,
    music,
    ...(options?.palette ? { palette: options.palette } : {}),
  };
}

export const VIDEO_AI_FORMATS: VideoFormat[] = Object.keys(
  VIDEO_FORMAT_DIMENSIONS
) as VideoFormat[];

/** One AI storyboard → three format-ready VideoProjects (no extra AI calls). */
export function resolveAiGeneratedVideoProjectsForAllFormats(
  tokens: Partial<VideoTemplateTokens>,
  binding: DesignBinding,
  options?: Omit<ResolveAiGeneratedVideoOptions, 'mediaOffset'>
): Array<{ format: VideoFormat; project: VideoProject }> {
  return VIDEO_AI_FORMATS.map((format, formatIndex) => ({
    format,
    project: resolveAiGeneratedVideoProject(tokens, binding, format, {
      ...options,
      mediaOffset: formatIndex * 2,
    }),
  }));
}
