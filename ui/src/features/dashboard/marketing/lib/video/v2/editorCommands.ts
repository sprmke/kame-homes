/**
 * Pure helpers the v2 editor UI calls to build items and describe them. No React, no DOM.
 */

import type { MediaDragPayload } from '@/features/dashboard/marketing/lib/media/mediaDrag';
import {
  duplicateItem,
  findItem,
  insertItem,
  mainRoomFrames,
  newId,
  type ClipboardEntry,
  type OpResult,
} from '@/features/dashboard/marketing/lib/video/v2/timelineOps';
import {
  formatTimecode,
  itemEnd,
  mainTrackOf,
  peakVisibleVideos,
  sourceDurationFrames,
  allItems,
} from '@/features/dashboard/marketing/lib/video/v2/timelineTiming';
import {
  DEFAULT_VISUAL_TRANSFORM,
  VIDEO_V2_LIMITS,
  isAudioItem,
  isLayerItem,
  isMediaItem,
  type AudioItem,
  type LayerItem,
  type MediaItem,
  type MediaRef,
  type VideoItem,
  type VideoProjectV2,
  type VideoTrackKind,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import type { VideoSceneLayer } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import { VIDEO_MUSIC_DEFAULT_VOLUME } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';

function refFromPayload(payload: MediaDragPayload): MediaRef {
  const ref: MediaRef = { url: payload.url, source: payload.source };
  if (payload.assetId) ref.assetId = payload.assetId;
  if (payload.width) ref.width = payload.width;
  if (payload.height) ref.height = payload.height;
  if (payload.durationMs) ref.durationMs = payload.durationMs;
  if (payload.posterUrl) ref.posterUrl = payload.posterUrl;
  return ref;
}

/**
 * Length for a freshly added clip: stills get 3 s; video and audio get their source length
 * (3 s when unknown), never longer than the 60 s cap allows from `from`.
 */
export function defaultClipFrames(
  payload: Pick<MediaDragPayload, 'kind' | 'durationMs'>,
  fps: number,
  from: number
): number {
  const room = Math.max(VIDEO_V2_LIMITS.minItemFrames, VIDEO_V2_LIMITS.maxDurationFrames - from);
  if (payload.kind === 'image') return Math.min(VIDEO_V2_LIMITS.defaultItemFrames, room);
  const source = sourceDurationFrames({ durationMs: payload.durationMs ?? undefined }, fps);
  return Math.min(source ?? VIDEO_V2_LIMITS.defaultItemFrames, room);
}

/** Visual clip (photo or video) from a library/gallery drop. `track` decides main vs overlay look. */
export function mediaItemFromPayload(
  payload: MediaDragPayload,
  options: { fps: number; from?: number; track: 'main' | 'overlay' }
): MediaItem {
  if (payload.kind === 'audio') throw new Error('audio is not a visual clip');
  const from = options.from ?? 0;
  const item: MediaItem = {
    id: newId('item'),
    type: payload.kind,
    from,
    durationInFrames: defaultClipFrames(payload, options.fps, from),
    label: payload.title,
    media: refFromPayload(payload),
    fit: 'cover',
    transform:
      options.track === 'main'
        ? { ...DEFAULT_VISUAL_TRANSFORM }
        : { x: 50, y: 50, widthPct: 60, rotation: 0, opacity: 1 },
  };
  if (payload.kind === 'video') {
    item.trimBeforeFrames = 0;
    item.volume = 1;
  }
  return item;
}

export function audioItemFromPayload(
  payload: MediaDragPayload,
  options: { fps: number; from?: number }
): AudioItem {
  const from = options.from ?? 0;
  return {
    id: newId('item'),
    type: 'audio',
    from,
    durationInFrames: defaultClipFrames(payload, options.fps, from),
    label: payload.title,
    media: refFromPayload(payload),
    volume: VIDEO_MUSIC_DEFAULT_VOLUME,
    title: payload.title,
    trimBeforeFrames: 0,
    ...(payload.artist ? { artist: payload.artist } : {}),
    ...(payload.trackId ? { trackId: payload.trackId } : {}),
  };
}

// ─── Text presets ───────────────────────────────────────────────────────────

export type TextPresetId = 'headline' | 'caption' | 'lower-third' | 'cta';

export type TextPreset = {
  id: TextPresetId;
  label: string;
  text: string;
  kind: 'text' | 'cta';
  textStyle?: VideoSceneLayer['textStyle'];
  position: { x: number; y: number; align: 'left' | 'center' | 'right' };
  animationIn: NonNullable<LayerItem['animationIn']>;
  animationOut?: NonNullable<LayerItem['animationOut']>;
};

export const TEXT_PRESETS: TextPreset[] = [
  {
    id: 'headline',
    label: 'Headline',
    text: 'Your headline',
    kind: 'text',
    textStyle: 'headline',
    position: { x: 50, y: 38, align: 'center' },
    animationIn: { type: 'rise', durationInFrames: 14 },
    animationOut: { type: 'fade', durationInFrames: 8 },
  },
  {
    id: 'caption',
    label: 'Caption',
    text: 'Add a caption',
    kind: 'text',
    textStyle: 'body',
    position: { x: 50, y: 78, align: 'center' },
    animationIn: { type: 'fade', durationInFrames: 10 },
    animationOut: { type: 'fade', durationInFrames: 8 },
  },
  {
    id: 'lower-third',
    label: 'Lower third',
    text: 'Name or place',
    kind: 'text',
    textStyle: 'subheadline',
    position: { x: 8, y: 84, align: 'left' },
    animationIn: { type: 'slide-up', durationInFrames: 14 },
    animationOut: { type: 'fade', durationInFrames: 8 },
  },
  {
    id: 'cta',
    label: 'Button',
    text: 'Book now',
    kind: 'cta',
    position: { x: 50, y: 88, align: 'center' },
    animationIn: { type: 'pop', durationInFrames: 14 },
    animationOut: { type: 'fade', durationInFrames: 8 },
  },
];

export function textPresetById(id: TextPresetId): TextPreset {
  return TEXT_PRESETS.find((preset) => preset.id === id) ?? TEXT_PRESETS[0]!;
}

export function layerItemFromPreset(
  preset: TextPreset,
  options: { from: number; durationInFrames?: number; text?: string }
): LayerItem {
  const layer: VideoSceneLayer = {
    id: newId('layer'),
    kind: preset.kind,
    text: options.text ?? preset.text,
    position: { ...preset.position },
  };
  if (preset.textStyle) layer.textStyle = preset.textStyle;
  const item: LayerItem = {
    id: newId('item'),
    type: 'layer',
    from: options.from,
    durationInFrames: Math.max(
      VIDEO_V2_LIMITS.minItemFrames,
      options.durationInFrames ?? VIDEO_V2_LIMITS.defaultItemFrames
    ),
    layer,
    animationIn: preset.animationIn,
  };
  if (preset.animationOut) item.animationOut = preset.animationOut;
  return item;
}

// ─── Descriptions ───────────────────────────────────────────────────────────

/** Short human label for a timeline block. */
export function itemLabel(item: VideoItem): string {
  if (isLayerItem(item)) {
    const text = item.layer.text?.trim() || item.layer.lines?.join(', ').trim();
    if (text) return text.length > 40 ? `${text.slice(0, 39)}…` : text;
    return item.layer.kind === 'logo' ? 'Logo' : item.layer.kind === 'image' ? 'Photo' : 'Text';
  }
  if (item.label?.trim()) return item.label.trim();
  if (isAudioItem(item)) return item.title?.trim() || 'Audio';
  return item.type === 'video' ? 'Video' : 'Photo';
}

/** "Clip, 0:03 to 0:07" for screen readers and tooltips. */
export function itemAriaLabel(item: VideoItem, fps: number): string {
  const kind = isAudioItem(item)
    ? 'Audio'
    : isLayerItem(item)
      ? 'Text'
      : item.type === 'video'
        ? 'Video'
        : 'Photo';
  return `${kind}, ${itemLabel(item)}, ${formatTimecode(item.from, fps)} to ${formatTimecode(itemEnd(item), fps)}`;
}

export function trackLabel(kind: VideoTrackKind, indexWithinKind: number): string {
  const base = { main: 'Main', overlay: 'Overlay', text: 'Text', audio: 'Audio' }[kind];
  return kind === 'main' ? base : `${base} ${indexWithinKind + 1}`;
}

/** True when anything in the project makes sound (decides whether export needs an audio track). */
export function projectHasAudio(project: VideoProjectV2): boolean {
  for (const track of project.tracks) {
    if (track.muted) continue;
    for (const item of track.items) {
      if (isAudioItem(item) && item.volume > 0 && item.media.url) return true;
      if (isMediaItem(item) && item.type === 'video' && !item.muted && (item.volume ?? 1) > 0) {
        return true;
      }
    }
  }
  return false;
}

export type ProjectWarning =
  | { code: 'too_many_videos'; peak: number }
  | { code: 'missing_media'; count: number }
  | { code: 'nearly_full'; seconds: number };

/** Non-blocking notes shown in the project inspector. */
export function projectWarnings(project: VideoProjectV2): ProjectWarning[] {
  const out: ProjectWarning[] = [];
  const peak = peakVisibleVideos(project);
  if (peak > VIDEO_V2_LIMITS.maxVisibleVideos) out.push({ code: 'too_many_videos', peak });
  const missing = allItems(project).filter(
    (item) => (isMediaItem(item) || isAudioItem(item)) && !item.media.url.trim()
  ).length;
  if (missing > 0) out.push({ code: 'missing_media', count: missing });
  const room = mainRoomFrames(project);
  if (room < project.fps * 2 && mainTrackOf(project).items.length > 0) {
    out.push({ code: 'nearly_full', seconds: Math.round(room / project.fps) });
  }
  return out;
}

/** Ids of every item whose media references `assetId` (for "used in" and replace flows). */
export function itemsUsingAsset(project: VideoProjectV2, assetId: string): string[] {
  return allItems(project)
    .filter((item) => (isMediaItem(item) || isAudioItem(item)) && item.media.assetId === assetId)
    .map((item) => item.id);
}

/** Swap an item's media for another asset, keeping placement and clamping video length. */
export function replaceItemMedia(
  item: MediaItem | AudioItem,
  payload: MediaDragPayload,
  fps: number
): MediaItem | AudioItem {
  const media = refFromPayload(payload);
  if (isAudioItem(item)) return { ...item, media, trimBeforeFrames: 0 };
  const type = payload.kind === 'video' ? 'video' : 'image';
  const next: MediaItem = { ...item, type, media };
  if (type === 'video') {
    next.trimBeforeFrames = 0;
    next.volume = item.volume ?? 1;
    const source = sourceDurationFrames(media, fps);
    if (source !== null) {
      next.durationInFrames = Math.min(
        item.durationInFrames,
        Math.max(VIDEO_V2_LIMITS.minItemFrames, Math.floor(source / (next.playbackRate ?? 1)))
      );
    }
  } else {
    delete next.trimBeforeFrames;
    delete next.playbackRate;
    delete next.volume;
    delete next.muted;
  }
  return next;
}

/**
 * Insert a library/gallery drop where the host released it. Photos and video go to the main
 * track when dropped on it, otherwise onto an overlay track (a lane of the wrong kind, such as a
 * text lane, falls back to a new overlay track). Audio always lands on an audio track.
 */
export function insertPayload(
  project: VideoProjectV2,
  payload: MediaDragPayload,
  target: { frame: number; trackId: string | null; onMain: boolean }
): OpResult {
  const lane = target.trackId ? project.tracks.find((track) => track.id === target.trackId) : null;
  if (payload.kind === 'audio') {
    const item = audioItemFromPayload(payload, { fps: project.fps, from: target.frame });
    return insertItem(project, item, {
      trackId: lane?.kind === 'audio' ? lane.id : undefined,
      kind: 'audio',
      atFrame: target.frame,
    });
  }
  if (target.onMain || (lane?.kind === 'main' && !target.trackId)) {
    const item = mediaItemFromPayload(payload, {
      fps: project.fps,
      track: 'main',
      from: target.frame,
    });
    return insertItem(project, item, { trackId: lane?.id, kind: 'main', atFrame: target.frame });
  }
  const item = mediaItemFromPayload(payload, {
    fps: project.fps,
    track: 'overlay',
    from: target.frame,
  });
  return insertItem(project, item, {
    trackId: lane?.kind === 'overlay' ? lane.id : undefined,
    kind: 'overlay',
    atFrame: target.frame,
  });
}

/** Duplicate several items in turn. The first refusal stops the batch and is reported as is. */
export function duplicateItems(project: VideoProjectV2, ids: string[]): OpResult {
  let working = project;
  const created: string[] = [];
  let clamped = false;
  for (const id of ids) {
    const result = duplicateItem(working, id);
    if (!result.ok) {
      return created.length === 0
        ? result
        : { project: working, ok: true, itemIds: created, clamped };
    }
    working = result.project;
    clamped = clamped || Boolean(result.clamped);
    if (result.itemIds) created.push(...result.itemIds);
  }
  if (created.length === 0) return { project, ok: false, reason: 'not_found' };
  return { project: working, ok: true, itemIds: created, clamped };
}

/** Clipboard entries for the given ids, in timeline order. Ids that no longer exist are skipped. */
export function clipboardFor(project: VideoProjectV2, ids: string[]): ClipboardEntry[] {
  const entries: ClipboardEntry[] = [];
  for (const id of ids) {
    const loc = findItem(project, id);
    if (loc) entries.push({ item: loc.item, trackKind: loc.track.kind });
  }
  return entries.sort((a, b) => a.item.from - b.item.from);
}
