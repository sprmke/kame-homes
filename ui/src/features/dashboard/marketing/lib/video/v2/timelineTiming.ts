/**
 * Pure timing helpers for the v2 timeline. No React, no DOM.
 */

import {
  isAudioItem,
  isMediaItem,
  VIDEO_V2_LIMITS,
  type AudioItem,
  type MediaItem,
  type VideoItem,
  type VideoProjectV2,
  type VideoTrack,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

function framesToSeconds(frames: number, fps: number): number {
  return fps > 0 ? frames / fps : 0;
}/** `0:07` or `0:07.5` (tenths only when requested). */
export function formatTimecode(frames: number, fps: number, withTenths = false): string {
  const total = Math.max(0, framesToSeconds(frames, fps));
  const minutes = Math.floor(total / 60);
  const seconds = Math.floor(total % 60);
  const base = `${minutes}:${String(seconds).padStart(2, '0')}`;
  if (!withTenths) return base;
  return `${base}.${Math.floor((total - Math.floor(total)) * 10)}`;
}

export function itemEnd(item: Pick<VideoItem, 'from' | 'durationInFrames'>): number {
  return item.from + item.durationInFrames;
}

export function mainTrackOf(project: VideoProjectV2): VideoTrack {
  return project.tracks.find((track) => track.kind === 'main') ?? project.tracks[0]!;
}

/**
 * Overlap (in frames) between the previous main clip and `current`. Capped so a clip in the
 * middle of the track can host both an incoming and an outgoing transition.
 */
function mainTransitionOverlap(previous: MediaItem | null, current: MediaItem): number {
  if (!previous) return 0;
  const requested = current.transitionIn?.durationInFrames ?? 0;
  if (!current.transitionIn || current.transitionIn.type === 'none' || requested <= 0) return 0;
  const cap = Math.floor(Math.min(previous.durationInFrames, current.durationInFrames) / 2);
  return Math.max(0, Math.min(requested, cap));
}

/** Assign `from` to main-track clips: contiguous, minus transition overlaps. */
export function layoutMainTrack<T extends MediaItem>(items: T[]): T[] {
  const out: T[] = [];
  let cursor = 0;
  items.forEach((item, index) => {
    const previous = index > 0 ? out[index - 1]! : null;
    const overlap = mainTransitionOverlap(previous, item);
    const from = Math.max(0, cursor - overlap);
    out.push(item.from === from ? item : { ...item, from });
    cursor = from + item.durationInFrames;
  });
  return out;
}

/** Last frame (exclusive) used by any item. 0 for an empty project. */
export function contentEndFrame(project: VideoProjectV2): number {
  let end = 0;
  for (const track of project.tracks) {
    for (const item of track.items) end = Math.max(end, itemEnd(item));
  }
  return end;
}

/** Composition length: content end, within the Player minimum and the 60 s cap. */
export function projectDurationInFrames(project: VideoProjectV2): number {
  return Math.min(
    VIDEO_V2_LIMITS.maxDurationFrames,
    Math.max(VIDEO_V2_LIMITS.minProjectFrames, contentEndFrame(project))
  );
}

export function isItemActiveAt(item: Pick<VideoItem, 'from' | 'durationInFrames'>, frame: number) {
  return frame >= item.from && frame < itemEnd(item);
}

export type ActiveItem = { item: VideoItem; track: VideoTrack; trackIndex: number };

/** Items visible or audible at `frame`, bottom track first. */
export function itemsActiveAt(project: VideoProjectV2, frame: number): ActiveItem[] {
  const out: ActiveItem[] = [];
  project.tracks.forEach((track, trackIndex) => {
    for (const item of track.items) {
      if (isItemActiveAt(item, frame)) out.push({ item, track, trackIndex });
    }
  });
  return out;
}

/**
 * Topmost visible, selectable item at `frame` for canvas picking. Hidden tracks are skipped.
 * Falls back to the main clip when nothing sits above it.
 */
export function topmostVisualAt(project: VideoProjectV2, frame: number): ActiveItem | null {
  const visible = itemsActiveAt(project, frame).filter(
    ({ item, track }) => item.type !== 'audio' && !track.hidden
  );
  return visible.at(-1) ?? null;
}/** Source length in frames for video/audio at 1x, or null when unknown. */
export function sourceDurationFrames(media: { durationMs?: number }, fps: number): number | null {
  if (typeof media.durationMs !== 'number' || !Number.isFinite(media.durationMs)) return null;
  if (media.durationMs <= 0) return null;
  return Math.floor((media.durationMs / 1000) * fps);
}

/**
 * Longest timeline length a video/audio item can have given its trim-in and speed.
 * Looping audio and still images are unbounded (Infinity).
 */
export function maxItemDurationFrames(item: VideoItem, fps: number): number {
  if (item.type === 'image' || item.type === 'layer') return Number.POSITIVE_INFINITY;
  if (isAudioItem(item) && item.loop) return Number.POSITIVE_INFINITY;
  const source = sourceDurationFrames(item.media, fps);
  if (source === null) return Number.POSITIVE_INFINITY;
  const rate = isMediaItem(item) ? (item.playbackRate ?? 1) : 1;
  const trim = item.trimBeforeFrames ?? 0;
  return Math.max(VIDEO_V2_LIMITS.minItemFrames, Math.floor((source - trim) / rate));
}

/** Timeline frames covered by `sourceFrames` of source at the item's speed. */
export function timelineFramesForSource(sourceFrames: number, rate: number): number {
  return Math.round(sourceFrames / (rate || 1));
}

/** Source frames consumed by `timelineFrames` at the item's speed. */
export function sourceFramesForTimeline(timelineFrames: number, rate: number): number {
  return Math.round(timelineFrames * (rate || 1));
}

export function allItems(project: VideoProjectV2): VideoItem[] {
  return project.tracks.flatMap((track) => track.items);
}

export function countItems(project: VideoProjectV2): number {
  return project.tracks.reduce((n, track) => n + track.items.length, 0);
}

export function audioItems(project: VideoProjectV2): AudioItem[] {
  return allItems(project).filter(isAudioItem);
}

/** How many video clips are visible at `frame` (preview decode budget). */
function visibleVideoCountAt(project: VideoProjectV2, frame: number): number {
  return itemsActiveAt(project, frame).filter(
    ({ item, track }) => item.type === 'video' && !track.hidden
  ).length;
}

/** Highest `visibleVideoCountAt` over the project (checked at item boundaries). */
export function peakVisibleVideos(project: VideoProjectV2): number {
  const points = new Set<number>([0]);
  for (const item of allItems(project)) {
    if (item.type === 'video') {
      points.add(item.from);
      points.add(Math.max(0, itemEnd(item) - 1));
    }
  }
  let peak = 0;
  for (const frame of points) peak = Math.max(peak, visibleVideoCountAt(project, frame));
  return peak;
}
