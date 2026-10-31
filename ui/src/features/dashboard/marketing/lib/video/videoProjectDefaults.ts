import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import {
  pickBindingMediaAt,
  resolveDesignBindingMedia,
} from '@/features/dashboard/marketing/lib/propertyBindingMedia';
import { normalizeVideoCategory } from '@/features/dashboard/marketing/lib/video/videoCategories';
import { isVideoMotionOverride } from '@/features/dashboard/marketing/lib/video/videoMotionProfiles';
import {
  DEFAULT_VIDEO_MUSIC,
  VIDEO_MUSIC_CLEARED_TRACK_ID,
} from '@/features/dashboard/marketing/lib/video/videoMusicPresets';
import type {
  VideoFormat,
  VideoProject,
  VideoProjectMusic,
  VideoScene,
  VideoSceneTextFields,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import {
  VIDEO_FPS,
  VIDEO_MUSIC_DEFAULT_VOLUME,
  VIDEO_SCENE_DURATION,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import { createSceneId } from '@/features/dashboard/marketing/lib/video/videoProjectUtils';
import {
  defaultLayersForKind,
  normalizeSceneLayers,
  persistSceneLayers,
} from '@/features/dashboard/marketing/lib/video/videoSceneLayers';
import { textsForStoryboardBeats } from '@/features/dashboard/marketing/lib/video/videoSceneTexts';
import type {
  VideoOverlayMode,
  VideoStoryboardClip,
} from '@/features/dashboard/marketing/lib/video/videoStoryboardRecipes';
import { resolveVideoStoryboardRecipe } from '@/features/dashboard/marketing/lib/video/videoStoryboardRecipes';
import {
  defaultTextLayoutForSceneKind,
  normalizeSceneTextLayout,
} from '@/features/dashboard/marketing/lib/video/videoTextSlots';
import { defaultVideoFields } from '@/features/dashboard/marketing/lib/videoCampaignTemplates';

function normalizeCampaignCategory(value: string | undefined, fallback: string): string {
  return normalizeVideoCategory(value, normalizeVideoCategory(fallback));
}

function normalizeScene(scene: VideoScene): VideoScene {
  const normalized = normalizeSceneLayers(normalizeSceneTextLayout(scene));
  if (normalized.motion !== undefined && !isVideoMotionOverride(normalized.motion)) {
    return { ...normalized, motion: undefined };
  }
  return normalized;
}

function clampDuration(seconds: number): number {
  return Math.min(
    VIDEO_SCENE_DURATION.max,
    Math.max(VIDEO_SCENE_DURATION.min, Number(seconds.toFixed(2)))
  );
}

function sceneFromClip(
  templateId: string,
  clip: VideoStoryboardClip,
  background: { url: string | null; mediaType: 'image' | 'video' },
  sourceTexts: VideoSceneTextFields
): VideoScene {
  const texts = textsForStoryboardBeats(clip.textBeats, sourceTexts);
  const textLayout = defaultTextLayoutForSceneKind(clip.kind, templateId);
  const base: VideoScene = {
    id: createSceneId(),
    kind: clip.kind,
    label: clip.label,
    durationSec: clampDuration(clip.durationSec),
    transition: clip.transition,
    overlay: clip.overlay,
    motion: clip.motion,
    imageUrl: background.url,
    backgroundMediaType: background.mediaType,
    texts,
    textLayout,
  };

  // Seed layers from storyboard beats so photo amenity words / CTA offer lines
  // are never dropped by kind-default layer builders.
  return persistSceneLayers(
    base,
    defaultLayersForKind(clip.kind, background.url, texts, templateId)
  );
}

/** Build a project from the Quiet Coast Motion storyboard recipe. */
export function buildDefaultVideoProject(
  templateId: string,
  category: string,
  binding: DesignBinding,
  format: VideoFormat = 'instagram-story'
): VideoProject {
  const recipe = resolveVideoStoryboardRecipe(templateId);
  const texts = defaultVideoFields(recipe.id, binding);
  const media = resolveDesignBindingMedia({
    propertyMedia: binding.propertyMedia,
    propertyPhoto: binding.propertyPhoto,
  });

  const scenes = recipe.clips.map((clip, index) => {
    const background = pickBindingMediaAt(media, index);
    return normalizeScene(sceneFromClip(recipe.id, clip, background, texts));
  });

  const music: VideoProjectMusic = recipe.musicCue
    ? {
        title: recipe.musicCue.title,
        artist: recipe.musicCue.artist,
        source: 'jamendo',
        url: null,
        volume: VIDEO_MUSIC_DEFAULT_VOLUME,
      }
    : { ...DEFAULT_VIDEO_MUSIC };

  return {
    version: 1,
    templateId: recipe.id,
    campaignCategory: recipe.category || category,
    format,
    fps: VIDEO_FPS,
    scenes,
    music,
  };
}

function normalizeProjectMusic(raw: Partial<VideoProjectMusic> | undefined): VideoProjectMusic {
  if (!raw) {
    return { ...DEFAULT_VIDEO_MUSIC };
  }

  const volume =
    typeof raw.volume === 'number'
      ? Math.min(1, Math.max(0, raw.volume))
      : VIDEO_MUSIC_DEFAULT_VOLUME;

  if (raw.trackId === VIDEO_MUSIC_CLEARED_TRACK_ID) {
    return { url: null, volume, trackId: VIDEO_MUSIC_CLEARED_TRACK_ID };
  }

  const normalized: VideoProjectMusic = {
    url: typeof raw.url === 'string' ? raw.url : null,
    volume,
    title: typeof raw.title === 'string' ? raw.title : undefined,
    artist: typeof raw.artist === 'string' ? raw.artist : undefined,
    source:
      raw.source === 'jamendo' || raw.source === 'upload' || raw.source === 'url'
        ? raw.source
        : undefined,
    trackId: typeof raw.trackId === 'string' ? raw.trackId : undefined,
  };

  if (
    !normalized.url &&
    normalized.trackId !== VIDEO_MUSIC_CLEARED_TRACK_ID &&
    !normalized.trackId &&
    !normalized.title &&
    !normalized.source
  ) {
    return { ...DEFAULT_VIDEO_MUSIC, volume };
  }

  return normalized;
}

const OVERLAY_MODES = new Set<VideoOverlayMode>(['none', 'soft-scrim', 'bottom-band', 'top-band']);

function normalizeOverlay(value: unknown): VideoOverlayMode | undefined {
  if (typeof value === 'string' && OVERLAY_MODES.has(value as VideoOverlayMode)) {
    return value as VideoOverlayMode;
  }
  return undefined;
}

export function parseVideoProject(
  raw: unknown,
  fallbackTemplateId: string,
  category: string,
  binding: DesignBinding,
  format: VideoFormat
): VideoProject {
  if (!raw || typeof raw !== 'object') {
    return buildDefaultVideoProject(fallbackTemplateId, category, binding, format);
  }

  const data = raw as Partial<VideoProject>;
  if (data.version !== 1 || !Array.isArray(data.scenes) || data.scenes.length === 0) {
    return buildDefaultVideoProject(fallbackTemplateId, category, binding, format);
  }

  const templateId = typeof data.templateId === 'string' ? data.templateId : fallbackTemplateId;
  const recipe = resolveVideoStoryboardRecipe(templateId);

  return {
    version: 1,
    templateId,
    campaignCategory: normalizeCampaignCategory(
      typeof data.campaignCategory === 'string' ? data.campaignCategory : undefined,
      recipe.category || category
    ),
    format: data.format ?? format,
    fps: typeof data.fps === 'number' ? data.fps : VIDEO_FPS,
    scenes: data.scenes.map((scene) => {
      const normalized = normalizeScene(scene as VideoScene);
      const overlay = normalizeOverlay((scene as VideoScene).overlay) ?? normalized.overlay;
      return overlay ? { ...normalized, overlay } : normalized;
    }),
    music: normalizeProjectMusic(data.music),
  };
}
