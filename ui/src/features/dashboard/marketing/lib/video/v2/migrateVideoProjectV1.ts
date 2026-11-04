/**
 * Lossless-for-timing migration of a v1 scene project to the v2 track model.
 *
 * - Every scene becomes one main-track clip with the same duration, transition overlap, motion
 *   override, scrim and scene kind, so the main timeline matches `videoProjectDurationInFrames`.
 * - Every non-empty overlay layer (headline, caption, CTA, slot chips, logo, photo) becomes a
 *   `LayerItem` on a text track, spanning its scene up to the start of the next transition.
 *   Layers keep the v1 `VideoSceneLayer` payload, so typography and template looks are identical.
 * - Music becomes one looping audio clip across the project.
 *
 * Layers use as few tracks as the busiest scene needs (rank within the scene), not one per role.
 */

import { normalizeProject } from '@/features/dashboard/marketing/lib/video/v2/timelineOps';
import { projectDurationInFrames } from '@/features/dashboard/marketing/lib/video/v2/timelineTiming';
import {
  DEFAULT_PROJECT_BACKGROUND,
  DEFAULT_VISUAL_TRANSFORM,
  VIDEO_V2_LIMITS,
  type AudioItem,
  type LayerItem,
  type MediaItem,
  type MediaSource,
  type VideoProjectV2,
  type VideoTrack,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import { layerHasContent } from '@/features/dashboard/marketing/lib/video/videoLayerContent';
import type {
  VideoProject,
  VideoScene,
  VideoSceneLayer,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import {
  VIDEO_FPS,
  VIDEO_MUSIC_DEFAULT_VOLUME,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import {
  sceneDurationInFrames,
  transitionDurationInFrames,
} from '@/features/dashboard/marketing/lib/video/videoProjectUtils';
import {
  getSceneLayers,
  sceneBackgroundLayer,
} from '@/features/dashboard/marketing/lib/video/videoSceneLayers';

/** Fade-out applied to a layer that ends where the next scene's transition begins. */
const LAYER_FADE_OUT_FRAMES = 6;

function mediaSourceForUrl(url: string | null | undefined): MediaSource {
  if (!url) return 'property';
  if (url.includes('/marketing-media/')) return 'library';
  if (url.includes('/marketing-audio/')) return 'upload';
  return 'property';
}

function trackId(prefix: string, index: number): string {
  return `${prefix}-${index}`;
}

function sceneToMediaItem(scene: VideoScene, index: number, fps: number): MediaItem {
  const background = sceneBackgroundLayer(scene);
  const url = background?.imageUrl?.trim() ?? '';
  const isVideo = background?.mediaType === 'video';
  const item: MediaItem = {
    id: scene.id,
    type: isVideo ? 'video' : 'image',
    from: 0,
    durationInFrames: sceneDurationInFrames(scene, fps),
    label: scene.label,
    sceneKind: scene.kind,
    media: { url, source: mediaSourceForUrl(url) },
    fit: 'cover',
    transform: { ...DEFAULT_VISUAL_TRANSFORM },
    overlay: scene.overlay ?? 'soft-scrim',
  };
  if (isVideo) {
    // v1 played background clips muted and looped; keep that until the host changes it.
    item.muted = true;
    item.volume = 0;
    item.trimBeforeFrames = 0;
  }
  if (scene.motion !== undefined) item.motion = scene.motion;
  if (index > 0 && scene.transition !== 'none') {
    item.transitionIn = {
      type: scene.transition,
      durationInFrames: transitionDurationInFrames(scene.transition),
    };
  }
  return item;
}

function layerSpan(
  scene: VideoScene,
  next: VideoScene | undefined,
  fps: number
): { duration: number; fadeOut: boolean } {
  const full = sceneDurationInFrames(scene, fps);
  const overlap = next ? transitionDurationInFrames(next.transition) : 0;
  const trimmed = full - overlap;
  if (overlap > 0 && trimmed >= VIDEO_V2_LIMITS.minItemFrames * 4) {
    return { duration: trimmed, fadeOut: true };
  }
  return { duration: full, fadeOut: false };
}

function layerToItem(
  scene: VideoScene,
  layer: VideoSceneLayer,
  from: number,
  span: { duration: number; fadeOut: boolean }
): LayerItem {
  const item: LayerItem = {
    id: `${scene.id}:${layer.id}`,
    type: 'layer',
    from,
    durationInFrames: span.duration,
    sceneKind: scene.kind,
    layer,
    animationIn: { type: 'template', durationInFrames: 0 },
  };
  if (span.fadeOut) {
    item.animationOut = { type: 'fade', durationInFrames: LAYER_FADE_OUT_FRAMES };
  }
  return item;
}

export function migrateVideoProjectV1(project: VideoProject): VideoProjectV2 {
  const fps = project.fps || VIDEO_FPS;
  const mainItems = project.scenes.map((scene, index) => sceneToMediaItem(scene, index, fps));

  // Start frame of each scene = the derived main-track position (same math as v1 sceneStartFrame).
  const laidOut = normalizeProject({
    version: 2,
    templateId: project.templateId,
    campaignCategory: project.campaignCategory,
    format: project.format,
    fps,
    background: { ...DEFAULT_PROJECT_BACKGROUND },
    tracks: [{ id: 'main', kind: 'main', items: mainItems }],
  });
  const starts = laidOut.tracks[0]!.items.map((item) => item.from);

  const lanes: LayerItem[][] = [];
  project.scenes.forEach((scene, index) => {
    const span = layerSpan(scene, project.scenes[index + 1], fps);
    const layers = getSceneLayers(scene).filter(
      (layer) => layer.kind !== 'background' && layerHasContent(layer)
    );
    layers.forEach((layer, rank) => {
      (lanes[rank] ??= []).push(layerToItem(scene, layer, starts[index] ?? 0, span));
    });
  });

  const tracks: VideoTrack[] = [
    { id: 'main', kind: 'main', items: laidOut.tracks[0]!.items },
    ...lanes.map((items, index) => ({
      id: trackId('text', index),
      kind: 'text' as const,
      items,
    })),
  ];

  const result: VideoProjectV2 = {
    version: 2,
    templateId: project.templateId,
    campaignCategory: project.campaignCategory,
    format: project.format,
    fps,
    background: { ...DEFAULT_PROJECT_BACKGROUND },
    tracks,
  };
  if (project.palette) result.palette = project.palette;
  if (project.sourceReviewId !== undefined) result.sourceReviewId = project.sourceReviewId;

  const musicUrl = project.music?.url?.trim();
  if (musicUrl) {
    const total = projectDurationInFrames(result);
    const audio: AudioItem = {
      id: 'music',
      type: 'audio',
      from: 0,
      durationInFrames: total,
      label: project.music?.title,
      media: { url: musicUrl, source: project.music?.source ?? 'upload' },
      volume: project.music?.volume ?? VIDEO_MUSIC_DEFAULT_VOLUME,
      loop: true,
      title: project.music?.title,
      artist: project.music?.artist,
      trackId: project.music?.trackId,
    };
    tracks.push({ id: 'audio-0', kind: 'audio', items: [audio] });
  }

  return normalizeProject(result);
}
