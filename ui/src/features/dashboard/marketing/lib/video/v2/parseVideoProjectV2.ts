/**
 * Load any saved video project (v1 scenes or v2 tracks, possibly hand-edited or half-written)
 * into a valid `VideoProjectV2`. Never throws; falls back to the default template project.
 */

import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import { migrateVideoProjectV1 } from '@/features/dashboard/marketing/lib/video/v2/migrateVideoProjectV1';
import {
  createTrack,
  normalizeProject,
  resolveOverlaps,
} from '@/features/dashboard/marketing/lib/video/v2/timelineOps';
import {
  DEFAULT_PROJECT_BACKGROUND,
  DEFAULT_VISUAL_TRANSFORM,
  VIDEO_PLAYBACK_RATES,
  VIDEO_V2_FPS,
  VIDEO_V2_LIMITS,
  type AudioItem,
  type LayerItem,
  type MediaItem,
  type MediaRef,
  type MediaSource,
  type TextAnimation,
  type VideoItem,
  type VideoPlaybackRate,
  type VideoProjectV2,
  type VideoTrack,
  type VideoTrackKind,
  type VisualTransform,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import { isVideoMotionOverride } from '@/features/dashboard/marketing/lib/video/videoMotionProfiles';
import {
  buildDefaultVideoProject,
  parseVideoProject,
} from '@/features/dashboard/marketing/lib/video/videoProjectDefaults';
import type {
  VideoFormat,
  VideoLayerKind,
  VideoSceneKind,
  VideoSceneLayer,
  VideoTransition,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import type { VideoOverlayMode } from '@/features/dashboard/marketing/lib/video/videoStoryboardRecipes';

const TRANSITIONS = new Set<VideoTransition>([
  'none',
  'fade',
  'slide-left',
  'slide-up',
  'wipe',
  'dissolve',
  'flip',
  'clock-wipe',
  'zoom-in-out',
  'push-cut',
]);
const OVERLAYS = new Set<VideoOverlayMode>(['none', 'soft-scrim', 'bottom-band', 'top-band']);
const SCENE_KINDS = new Set<VideoSceneKind>(['photo', 'promo', 'slots', 'cta']);
const LAYER_KINDS = new Set<VideoLayerKind>(['image', 'logo', 'text', 'cta', 'slots']);
const SOURCES = new Set<MediaSource>(['property', 'library', 'ai', 'jamendo', 'upload', 'url']);
const FORMATS = new Set<VideoFormat>(['instagram-story', 'instagram-post', 'landscape']);
const ANIMATIONS = new Set<TextAnimation>([
  'none',
  'template',
  'fade',
  'slide-up',
  'pop',
  'typewriter',
  'rise',
]);
const TRACK_KINDS = new Set<VideoTrackKind>(['main', 'overlay', 'text', 'audio']);
const TEXT_STYLES = new Set(['headline', 'subheadline', 'promo', 'body', 'footer']);

type Rec = Record<string, unknown>;
const isRec = (value: unknown): value is Rec =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function num(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function int(value: unknown, fallback: number, min = 0, max = Infinity): number {
  return Math.round(num(value, fallback, min, max));
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function sanitizeMediaRef(raw: unknown): MediaRef {
  const o = isRec(raw) ? raw : {};
  const ref: MediaRef = {
    url: str(o.url)?.trim() ?? '',
    source: SOURCES.has(o.source as MediaSource) ? (o.source as MediaSource) : 'property',
  };
  if (typeof o.assetId === 'string') ref.assetId = o.assetId;
  if (typeof o.width === 'number' && o.width > 0) ref.width = Math.round(o.width);
  if (typeof o.height === 'number' && o.height > 0) ref.height = Math.round(o.height);
  if (typeof o.durationMs === 'number' && o.durationMs > 0)
    ref.durationMs = Math.round(o.durationMs);
  if (typeof o.posterUrl === 'string') ref.posterUrl = o.posterUrl;
  return ref;
}

function sanitizeTransform(raw: unknown): VisualTransform {
  const o = isRec(raw) ? raw : {};
  const base = DEFAULT_VISUAL_TRANSFORM;
  return {
    x: num(o.x, base.x, -50, 150),
    y: num(o.y, base.y, -50, 150),
    widthPct: num(o.widthPct, base.widthPct, 2, 300),
    rotation: num(o.rotation, base.rotation, -360, 360),
    opacity: num(o.opacity, base.opacity, 0, 1),
  };
}

function sanitizeBase(raw: Rec) {
  const base = {
    id: str(raw.id)?.trim() || `item-${crypto.randomUUID().slice(0, 8)}`,
    from: int(raw.from, 0, 0, VIDEO_V2_LIMITS.maxDurationFrames),
    durationInFrames: int(
      raw.durationInFrames,
      VIDEO_V2_LIMITS.defaultItemFrames,
      1,
      VIDEO_V2_LIMITS.maxDurationFrames
    ),
  } as {
    id: string;
    from: number;
    durationInFrames: number;
    label?: string;
    sceneKind?: VideoSceneKind;
  };
  if (typeof raw.label === 'string') base.label = raw.label.slice(0, 120);
  if (SCENE_KINDS.has(raw.sceneKind as VideoSceneKind))
    base.sceneKind = raw.sceneKind as VideoSceneKind;
  return base;
}

function sanitizeMedia(raw: Rec): MediaItem | null {
  if (raw.type !== 'image' && raw.type !== 'video') return null;
  const item: MediaItem = {
    ...sanitizeBase(raw),
    type: raw.type,
    media: sanitizeMediaRef(raw.media),
    fit: raw.fit === 'contain' ? 'contain' : 'cover',
    transform: sanitizeTransform(raw.transform),
  };
  if (isRec(raw.crop)) {
    const c = raw.crop;
    item.crop = {
      left: num(c.left, 0, 0, 0.9),
      right: num(c.right, 0, 0, 0.9),
      top: num(c.top, 0, 0, 0.9),
      bottom: num(c.bottom, 0, 0, 0.9),
    };
  }
  if (raw.motion !== undefined && isVideoMotionOverride(raw.motion)) item.motion = raw.motion;
  if (isRec(raw.adjust)) {
    item.adjust = {
      brightness: num(raw.adjust.brightness, 1, 0, 2),
      contrast: num(raw.adjust.contrast, 1, 0, 2),
      saturation: num(raw.adjust.saturation, 1, 0, 2),
    };
  }
  if (OVERLAYS.has(raw.overlay as VideoOverlayMode)) item.overlay = raw.overlay as VideoOverlayMode;
  if (isRec(raw.transitionIn) && TRANSITIONS.has(raw.transitionIn.type as VideoTransition)) {
    const type = raw.transitionIn.type as VideoTransition;
    if (type !== 'none') {
      item.transitionIn = {
        type,
        durationInFrames: int(raw.transitionIn.durationInFrames, 15, 1, 90),
      };
    }
  }
  if (raw.type === 'video') {
    item.trimBeforeFrames = int(raw.trimBeforeFrames, 0, 0);
    if (VIDEO_PLAYBACK_RATES.includes(raw.playbackRate as VideoPlaybackRate)) {
      item.playbackRate = raw.playbackRate as VideoPlaybackRate;
    }
    item.volume = num(raw.volume, 1, 0, 1);
    if (raw.muted === true) item.muted = true;
  }
  return item;
}

function sanitizeLayer(raw: unknown): VideoSceneLayer | null {
  if (!isRec(raw) || !LAYER_KINDS.has(raw.kind as VideoLayerKind)) return null;
  const pos = isRec(raw.position) ? raw.position : {};
  const layer: VideoSceneLayer = {
    id: str(raw.id)?.trim() || `layer-${crypto.randomUUID().slice(0, 8)}`,
    kind: raw.kind as VideoLayerKind,
    position: {
      x: num(pos.x, 50, -20, 120),
      y: num(pos.y, 50, -20, 120),
      align:
        pos.align === 'left' || pos.align === 'right' || pos.align === 'center'
          ? pos.align
          : undefined,
    },
  };
  if (!layer.position.align) delete layer.position.align;
  if (typeof raw.imageUrl === 'string' || raw.imageUrl === null)
    layer.imageUrl = raw.imageUrl as string | null;
  if (typeof raw.text === 'string') layer.text = raw.text.slice(0, 2000);
  if (Array.isArray(raw.lines)) {
    layer.lines = raw.lines.filter((l): l is string => typeof l === 'string').slice(0, 12);
  }
  if (TEXT_STYLES.has(raw.textStyle as string))
    layer.textStyle = raw.textStyle as VideoSceneLayer['textStyle'];
  if (isRec(raw.typography)) layer.typography = raw.typography as VideoSceneLayer['typography'];
  if (typeof raw.widthPct === 'number') layer.widthPct = num(raw.widthPct, 42, 4, 100);
  return layer;
}

function sanitizeAnimation(raw: unknown): LayerItem['animationIn'] {
  if (!isRec(raw) || !ANIMATIONS.has(raw.type as TextAnimation)) return undefined;
  return {
    type: raw.type as TextAnimation,
    durationInFrames: int(raw.durationInFrames, 12, 0, 120),
  };
}

function sanitizeLayerItem(raw: Rec): LayerItem | null {
  if (raw.type !== 'layer') return null;
  const layer = sanitizeLayer(raw.layer);
  if (!layer) return null;
  const item: LayerItem = { ...sanitizeBase(raw), type: 'layer', layer };
  const animationIn = sanitizeAnimation(raw.animationIn);
  const animationOut = sanitizeAnimation(raw.animationOut);
  if (animationIn) item.animationIn = animationIn;
  if (animationOut) item.animationOut = animationOut;
  return item;
}

function sanitizeAudio(raw: Rec): AudioItem | null {
  if (raw.type !== 'audio') return null;
  const media = sanitizeMediaRef(raw.media);
  if (!media.url) return null;
  const item: AudioItem = {
    ...sanitizeBase(raw),
    type: 'audio',
    media,
    volume: num(raw.volume, 0.5, 0, 1),
  };
  if (typeof raw.trimBeforeFrames === 'number')
    item.trimBeforeFrames = int(raw.trimBeforeFrames, 0, 0);
  if (typeof raw.fadeInFrames === 'number') item.fadeInFrames = int(raw.fadeInFrames, 0, 0, 900);
  if (typeof raw.fadeOutFrames === 'number') item.fadeOutFrames = int(raw.fadeOutFrames, 0, 0, 900);
  if (raw.loop === true) item.loop = true;
  if (typeof raw.title === 'string') item.title = raw.title.slice(0, 200);
  if (typeof raw.artist === 'string') item.artist = raw.artist.slice(0, 200);
  if (typeof raw.trackId === 'string') item.trackId = raw.trackId;
  return item;
}

function sanitizeItem(raw: unknown): VideoItem | null {
  if (!isRec(raw)) return null;
  return sanitizeMedia(raw) ?? sanitizeLayerItem(raw) ?? sanitizeAudio(raw);
}

function sanitizeTrack(raw: unknown): VideoTrack | null {
  if (!isRec(raw) || !TRACK_KINDS.has(raw.kind as VideoTrackKind) || !Array.isArray(raw.items)) {
    return null;
  }
  const track = createTrack(raw.kind as VideoTrackKind);
  if (typeof raw.id === 'string' && raw.id.trim()) track.id = raw.id.trim();
  if (typeof raw.name === 'string') track.name = raw.name.slice(0, 60);
  if (raw.hidden === true) track.hidden = true;
  if (raw.muted === true) track.muted = true;
  if (raw.locked === true) track.locked = true;
  track.items = raw.items
    .slice(0, VIDEO_V2_LIMITS.maxItems)
    .map(sanitizeItem)
    .filter((item): item is VideoItem => item !== null);
  return track;
}

function uniqueIds(project: VideoProjectV2): VideoProjectV2 {
  const seen = new Set<string>();
  const fresh = (id: string, prefix: string) => {
    let next = id;
    while (seen.has(next)) next = `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
    seen.add(next);
    return next;
  };
  return {
    ...project,
    tracks: project.tracks.map((track) => ({
      ...track,
      id: fresh(track.id, 'track'),
      items: track.items.map((item) => ({ ...item, id: fresh(item.id, 'item') })),
    })),
  };
}

/** Enforce the track/item caps on loaded data (extra tracks and items are dropped, last first). */
function capCounts(project: VideoProjectV2): VideoProjectV2 {
  let budget = VIDEO_V2_LIMITS.maxItems;
  const tracks = project.tracks.slice(0, VIDEO_V2_LIMITS.maxTracks).map((track) => {
    const items = track.items.slice(0, Math.max(0, budget));
    budget -= items.length;
    return { ...track, items };
  });
  return { ...project, tracks };
}

function sanitizeVideoProjectV2(raw: Rec, fallback: VideoProjectV2): VideoProjectV2 | null {
  if (!Array.isArray(raw.tracks)) return null;
  const parsed = raw.tracks
    .slice(0, VIDEO_V2_LIMITS.maxTracks * 2)
    .map(sanitizeTrack)
    .filter((track): track is VideoTrack => track !== null);
  const mains = parsed.filter((track) => track.kind === 'main');
  // Extra main tracks (never produced by the editor) are folded into the first one.
  const main = mains[0] ?? createTrack('main');
  main.items = [...main.items, ...mains.slice(1).flatMap((track) => track.items)];
  const rest = parsed.filter((track) => track.kind !== 'main');

  const bg = isRec(raw.background) ? raw.background : {};
  const project: VideoProjectV2 = {
    version: 2,
    templateId: str(raw.templateId) ?? fallback.templateId,
    campaignCategory: str(raw.campaignCategory) ?? fallback.campaignCategory,
    format: FORMATS.has(raw.format as VideoFormat) ? (raw.format as VideoFormat) : fallback.format,
    fps:
      Number.isInteger(raw.fps) && (raw.fps as number) >= 1 && (raw.fps as number) <= 60
        ? (raw.fps as number)
        : VIDEO_V2_FPS,
    background: {
      color:
        typeof bg.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(bg.color)
          ? bg.color
          : DEFAULT_PROJECT_BACKGROUND.color,
      fill: bg.fill === 'blur' ? 'blur' : 'color',
    },
    tracks: [main, ...rest],
  };
  if (isRec(raw.palette)) project.palette = raw.palette as VideoProjectV2['palette'];
  if (typeof raw.sourceReviewId === 'string' || raw.sourceReviewId === null) {
    project.sourceReviewId = raw.sourceReviewId as string | null;
  }
  return normalizeProject(resolveOverlaps(normalizeProject(capCounts(uniqueIds(project)))));
}

export function parseVideoProjectV2(
  raw: unknown,
  fallbackTemplateId: string,
  category: string,
  binding: DesignBinding,
  format: VideoFormat
): VideoProjectV2 {
  const buildFallback = () =>
    migrateVideoProjectV1(buildDefaultVideoProject(fallbackTemplateId, category, binding, format));

  if (!isRec(raw)) return buildFallback();

  if (raw.version === 2) {
    const fallback = buildFallback();
    const sanitized = sanitizeVideoProjectV2(raw, fallback);
    if (sanitized && sanitized.tracks[0]!.items.length > 0) return sanitized;
    return fallback;
  }

  const v1 = parseVideoProject(raw, fallbackTemplateId, category, binding, format);
  const migrated = migrateVideoProjectV1(v1);
  // `parseVideoProject` drops these two; keep them so reviews and palettes survive the upgrade.
  if (isRec(raw.palette) && !migrated.palette) {
    migrated.palette = raw.palette as VideoProjectV2['palette'];
  }
  if (typeof raw.sourceReviewId === 'string' && migrated.sourceReviewId === undefined) {
    migrated.sourceReviewId = raw.sourceReviewId;
  }
  return migrated;
}
