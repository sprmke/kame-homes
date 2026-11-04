/**
 * Pure, immutable edit operations for `VideoProjectV2`. Every operation returns an `OpResult`
 * so the UI can tell the host why nothing happened (locked track, limit reached, ...).
 *
 * Invariants (checked by `validateProject`, enforced by `normalizeProject`):
 *  - `tracks[0]` is the single `main` track; its clips are contiguous (magnetic) and `from` is
 *    derived from order, durations and transition overlaps.
 *  - Items on overlay/text/audio tracks never overlap within a track; an op that would overlap
 *    creates a new track instead (CapCut behaviour).
 *  - Nothing extends past 60 s, and the track/item caps hold.
 *  - Video/audio items never exceed their source length at their speed.
 */

import {
  countItems,
  itemEnd,
  layoutMainTrack,
  mainTrackOf,
  maxItemDurationFrames,
  sourceFramesForTimeline,
  timelineFramesForSource,
} from '@/features/dashboard/marketing/lib/video/v2/timelineTiming';
import {
  isAudioItem,
  isLayerItem,
  isMediaItem,
  trackAccepts,
  VIDEO_V2_LIMITS,
  type AudioItem,
  type MediaItem,
  type VideoItem,
  type VideoPlaybackRate,
  type VideoProjectV2,
  type VideoTrack,
  type VideoTrackKind,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import type { VideoTransition } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';

export type OpFailure =
  | 'not_found'
  | 'locked'
  | 'incompatible'
  | 'item_limit'
  | 'track_limit'
  | 'duration_limit'
  | 'no_room'
  | 'invalid';

export type OpResult = {
  project: VideoProjectV2;
  ok: boolean;
  reason?: OpFailure;
  /** True when the requested change was cut to fit a limit (60 s cap, source length, neighbour). */
  clamped?: boolean;
  /** Ids created or moved by the op, for selection. */
  itemIds?: string[];
};

const { maxDurationFrames, maxTracks, maxItems, minItemFrames, transitionFrames } = VIDEO_V2_LIMITS;

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

const fail = (project: VideoProjectV2, reason: OpFailure): OpResult => ({
  project,
  ok: false,
  reason,
});

const done = (project: VideoProjectV2, extra: Partial<OpResult> = {}): OpResult => ({
  project,
  ok: true,
  ...extra,
});

// ─── Lookup ─────────────────────────────────────────────────────────────────

export type ItemLocation = {
  track: VideoTrack;
  trackIndex: number;
  item: VideoItem;
  itemIndex: number;
};

export function findItem(project: VideoProjectV2, itemId: string): ItemLocation | null {
  for (let trackIndex = 0; trackIndex < project.tracks.length; trackIndex += 1) {
    const track = project.tracks[trackIndex]!;
    const itemIndex = track.items.findIndex((item) => item.id === itemId);
    if (itemIndex >= 0) return { track, trackIndex, item: track.items[itemIndex]!, itemIndex };
  }
  return null;
}

function findTrack(project: VideoProjectV2, trackId: string) {
  const trackIndex = project.tracks.findIndex((track) => track.id === trackId);
  return trackIndex < 0 ? null : { track: project.tracks[trackIndex]!, trackIndex };
}

// ─── Construction / normalization ───────────────────────────────────────────

export function createTrack(kind: VideoTrackKind, items: VideoItem[] = []): VideoTrack {
  return { id: newId('track'), kind, items };
}

function withTrack(project: VideoProjectV2, trackIndex: number, track: VideoTrack): VideoProjectV2 {
  const tracks = project.tracks.slice();
  tracks[trackIndex] = track;
  return { ...project, tracks };
}

function sortByFrom<T extends VideoItem>(items: T[]): T[] {
  return items.slice().sort((a, b) => a.from - b.from);
}

/** Cut an item list to the 60 s cap: drop items fully past it, shorten the one that crosses it. */
function capItems<T extends VideoItem>(items: T[]): T[] {
  const out: T[] = [];
  for (const item of items) {
    if (item.from >= maxDurationFrames) continue;
    if (itemEnd(item) > maxDurationFrames) {
      out.push({
        ...item,
        durationInFrames: Math.max(minItemFrames, maxDurationFrames - item.from),
      });
      continue;
    }
    out.push(item);
  }
  return out;
}

function fitAudioFades(item: AudioItem): AudioItem {
  const budget = item.durationInFrames;
  const fadeIn = Math.max(0, Math.min(item.fadeInFrames ?? 0, budget));
  const fadeOut = Math.max(0, Math.min(item.fadeOutFrames ?? 0, budget - fadeIn));
  if (fadeIn === (item.fadeInFrames ?? 0) && fadeOut === (item.fadeOutFrames ?? 0)) return item;
  return { ...item, fadeInFrames: fadeIn, fadeOutFrames: fadeOut };
}

/**
 * Re-establish every structural invariant that does not need a decision: main track first and
 * magnetic, items sorted, nothing past the cap. Idempotent. Does NOT resolve overlaps on free
 * tracks (ops never create them; `resolveOverlaps` repairs untrusted input).
 */
export function normalizeProject(project: VideoProjectV2): VideoProjectV2 {
  const hasMain = project.tracks.some((track) => track.kind === 'main');
  const source = hasMain ? project.tracks : [createTrack('main'), ...project.tracks];
  const main = source.find((track) => track.kind === 'main')!;
  const rest = source.filter((track) => track !== main);

  const mainItems = layoutMainTrack(
    capItems(
      layoutMainTrack(
        main.items.filter(isMediaItem).map((item, index) => {
          if (index === 0 && item.transitionIn) {
            const { transitionIn: _dropped, ...withoutTransition } = item;
            return withoutTransition as MediaItem;
          }
          return item;
        })
      )
    )
  );

  const tracks: VideoTrack[] = [
    { ...main, items: mainItems },
    ...rest.map((track) => {
      const sorted = sortByFrom(track.items.filter((item) => trackAccepts(track.kind, item)));
      const capped = capItems(sorted).map((item) =>
        isAudioItem(item) ? fitAudioFades(item) : item
      );
      return { ...track, items: capped };
    }),
  ];
  return { ...project, tracks };
}

/**
 * Move overlapping items on free tracks onto new tracks of the same kind. For untrusted input
 * (loaded JSON, migrations). Returns the project unchanged when nothing overlaps. Items that
 * would need more than the track cap allows are dropped (only hostile input gets there).
 */
export function resolveOverlaps(project: VideoProjectV2): VideoProjectV2 {
  let changed = false;
  const tracks: VideoTrack[] = [];
  for (const track of project.tracks) {
    if (track.kind === 'main') {
      tracks.push(track);
      continue;
    }
    let remaining = sortByFrom(track.items);
    let first = true;
    while (remaining.length > 0) {
      const kept: VideoItem[] = [];
      const overflow: VideoItem[] = [];
      let cursor = 0;
      for (const item of remaining) {
        if (item.from >= cursor) {
          kept.push(item);
          cursor = itemEnd(item);
        } else {
          overflow.push(item);
        }
      }
      tracks.push(first ? { ...track, items: kept } : createTrack(track.kind, kept));
      if (!first) changed = true;
      first = false;
      remaining = overflow;
    }
    if (first) tracks.push(track); // empty track
  }
  if (!changed) return project;
  return { ...project, tracks: tracks.slice(0, maxTracks) };
}

export type ProjectViolation = string;

/** Human-readable list of broken invariants. Empty when the project is valid. Test/dev aid. */
export function validateProject(project: VideoProjectV2): ProjectViolation[] {
  const out: ProjectViolation[] = [];
  if (project.tracks[0]?.kind !== 'main') out.push('tracks[0] must be main');
  if (project.tracks.filter((t) => t.kind === 'main').length !== 1) out.push('exactly one main');
  if (project.tracks.length > maxTracks) out.push('too many tracks');
  if (countItems(project) > maxItems) out.push('too many items');

  const ids = new Set<string>();
  for (const track of project.tracks) {
    if (ids.has(track.id)) out.push(`duplicate track id ${track.id}`);
    ids.add(track.id);
    let previousEnd = 0;
    track.items.forEach((item, index) => {
      if (ids.has(item.id)) out.push(`duplicate id ${item.id}`);
      ids.add(item.id);
      if (!trackAccepts(track.kind, item)) out.push(`${item.id} not allowed on ${track.kind}`);
      if (!(item.durationInFrames >= 1)) out.push(`${item.id} has no duration`);
      if (!(item.from >= 0)) out.push(`${item.id} starts before 0`);
      if (itemEnd(item) > maxDurationFrames) out.push(`${item.id} past the cap`);
      if (track.kind !== 'main') {
        if (index > 0 && item.from < previousEnd) out.push(`${item.id} overlaps on ${track.id}`);
        previousEnd = itemEnd(item);
      }
      if (item.type === 'video' || item.type === 'audio') {
        const max = maxItemDurationFrames(item, project.fps);
        if (item.durationInFrames > max + 1) out.push(`${item.id} exceeds its source`);
      }
    });
    if (track.kind === 'main') {
      const laid = layoutMainTrack(track.items.filter(isMediaItem));
      laid.forEach((item, index) => {
        if (item.from !== track.items[index]!.from) out.push(`${item.id} main from not derived`);
      });
    }
  }
  return out;
}

// ─── Capacity helpers ───────────────────────────────────────────────────────

function overlaps(items: VideoItem[], from: number, end: number): boolean {
  return items.some((it) => it.from < end && itemEnd(it) > from);
}

/** Frames of the 60 s budget not yet used by the main track. */
export function mainRoomFrames(project: VideoProjectV2): number {
  const last = mainTrackOf(project).items.at(-1);
  return Math.max(0, maxDurationFrames - (last ? itemEnd(last) : 0));
}

/** Where a new track of `kind` goes: overlay above main/overlays, text above those, audio last. */
function newTrackIndex(tracks: VideoTrack[], kind: VideoTrackKind, near?: number): number {
  if (near !== undefined) return Math.min(tracks.length, near + 1);
  const lastIndexOf = (kinds: VideoTrackKind[]) => {
    for (let i = tracks.length - 1; i >= 0; i -= 1) if (kinds.includes(tracks[i]!.kind)) return i;
    return 0;
  };
  if (kind === 'overlay') return lastIndexOf(['main', 'overlay']) + 1;
  if (kind === 'text') return lastIndexOf(['main', 'overlay', 'text']) + 1;
  return tracks.length;
}

function freeKindFor(item: VideoItem): Exclude<VideoTrackKind, 'main'> {
  return isAudioItem(item) ? 'audio' : isLayerItem(item) ? 'text' : 'overlay';
}

/**
 * Put a free-track item somewhere it fits: the preferred track, then other tracks of the same
 * kind, then a new track directly above the preferred one (or by kind grouping).
 */
function placeOnFreeTrack(
  project: VideoProjectV2,
  item: VideoItem,
  preferredTrackId?: string | null
): { project: VideoProjectV2; trackIndex: number } | OpFailure {
  const kind = freeKindFor(item);
  const end = itemEnd(item);

  const candidates: number[] = [];
  const preferred = preferredTrackId ? findTrack(project, preferredTrackId) : null;
  if (preferred && preferred.track.kind === kind) candidates.push(preferred.trackIndex);
  project.tracks.forEach((track, index) => {
    if (track.kind === kind && !candidates.includes(index)) candidates.push(index);
  });

  for (const index of candidates) {
    const track = project.tracks[index]!;
    if (track.locked) continue;
    if (!overlaps(track.items, item.from, end)) {
      return {
        project: withTrack(project, index, { ...track, items: sortByFrom([...track.items, item]) }),
        trackIndex: index,
      };
    }
  }

  if (project.tracks.length >= maxTracks) return 'track_limit';
  const at = newTrackIndex(project.tracks, kind, preferred?.trackIndex);
  const tracks = project.tracks.slice();
  tracks.splice(at, 0, createTrack(kind, [item]));
  return { project: { ...project, tracks }, trackIndex: at };
}

function clampStartToCap(item: VideoItem): { item: VideoItem; clamped: boolean } {
  if (itemEnd(item) <= maxDurationFrames) return { item, clamped: false };
  if (item.durationInFrames > maxDurationFrames) {
    return { item: { ...item, from: 0, durationInFrames: maxDurationFrames }, clamped: true };
  }
  return { item: { ...item, from: maxDurationFrames - item.durationInFrames }, clamped: true };
}

// ─── Insert ─────────────────────────────────────────────────────────────────

/**
 * Main-track index for a drop at `frame`: before the first clip whose midpoint is after it.
 * Items listed in `excludeIds` are ignored (the clip being dragged).
 */
export function mainInsertIndex(
  project: VideoProjectV2,
  frame: number,
  excludeIds: string[] = []
): number {
  const items = mainTrackOf(project).items.filter((item) => !excludeIds.includes(item.id));
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!;
    if (frame < item.from + item.durationInFrames / 2) return i;
  }
  return items.length;
}

function insertMain(project: VideoProjectV2, item: MediaItem, index: number): OpResult {
  const main = mainTrackOf(project);
  if (main.locked) return fail(project, 'locked');
  const room = mainRoomFrames(project);
  if (room < minItemFrames) return fail(project, 'duration_limit');
  const clamped = item.durationInFrames > room;
  const fitted: MediaItem = clamped ? { ...item, durationInFrames: room } : item;
  const items = main.items.slice();
  items.splice(Math.max(0, Math.min(index, items.length)), 0, fitted);
  return done(normalizeProject(withTrack(project, 0, { ...main, items })), {
    clamped,
    itemIds: [item.id],
  });
}

export type InsertOptions = {
  /** Explicit destination track. */
  trackId?: string | null;
  /** Destination kind when no track is given (default by item type: media→main). */
  kind?: VideoTrackKind;
  atFrame?: number;
};

/**
 * Insert `item` at `atFrame`. Media on `main` ripples; everything else lands on a free track
 * (the preferred one when it fits, otherwise another or a new one).
 */
export function insertItem(
  project: VideoProjectV2,
  item: VideoItem,
  options: InsertOptions = {}
): OpResult {
  if (countItems(project) >= maxItems) return fail(project, 'item_limit');
  const atFrame = Math.max(0, Math.round(options.atFrame ?? 0));
  const target = options.trackId ? findTrack(project, options.trackId) : null;
  if (options.trackId && !target) return fail(project, 'not_found');

  const kind: VideoTrackKind =
    target?.track.kind ?? options.kind ?? (isMediaItem(item) ? 'main' : freeKindFor(item));
  if (!trackAccepts(kind, item)) return fail(project, 'incompatible');
  if (target?.track.locked) return fail(project, 'locked');

  if (kind === 'main' && isMediaItem(item)) {
    return insertMain(project, item, mainInsertIndex(project, atFrame));
  }

  const placed = clampStartToCap({ ...item, from: atFrame });
  const result = placeOnFreeTrack(project, placed.item, options.trackId);
  if (typeof result === 'string') return fail(project, result);
  return done(normalizeProject(result.project), { clamped: placed.clamped, itemIds: [item.id] });
}

// ─── Delete ─────────────────────────────────────────────────────────────────

export function deleteItems(
  project: VideoProjectV2,
  ids: string[],
  options: { ripple?: boolean } = {}
): OpResult {
  const wanted = new Set(ids);
  let changed = false;
  let blocked = false;
  const tracks = project.tracks.map((track) => {
    const hits = track.items.filter((item) => wanted.has(item.id));
    if (hits.length === 0) return track;
    if (track.locked) {
      blocked = true;
      return track;
    }
    changed = true;
    const keep = track.items.filter((item) => !wanted.has(item.id));
    if (track.kind === 'main' || !options.ripple) return { ...track, items: keep };
    // Ripple a free track: close each removed gap, earliest first.
    const removed = hits.slice().sort((a, b) => a.from - b.from);
    const shifted = keep.map((item) => {
      const shift = removed
        .filter((r) => itemEnd(r) <= item.from)
        .reduce((n, r) => n + r.durationInFrames, 0);
      return shift > 0 ? { ...item, from: item.from - shift } : item;
    });
    return { ...track, items: shifted };
  });
  if (!changed) return fail(project, blocked ? 'locked' : 'not_found');
  return done(normalizeProject({ ...project, tracks }));
}

// ─── Move ───────────────────────────────────────────────────────────────────

export function moveItem(
  project: VideoProjectV2,
  itemId: string,
  target: { frame: number; trackId?: string | null }
): OpResult {
  const loc = findItem(project, itemId);
  if (!loc) return fail(project, 'not_found');
  if (loc.track.locked) return fail(project, 'locked');
  const item = loc.item;
  const frame = Math.max(0, Math.round(target.frame));
  const destination = target.trackId
    ? findTrack(project, target.trackId)
    : { track: loc.track, trackIndex: loc.trackIndex };
  if (!destination) return fail(project, 'not_found');
  if (destination.track.locked) return fail(project, 'locked');
  if (!trackAccepts(destination.track.kind, item)) return fail(project, 'incompatible');

  const without = normalizeProject(
    withTrack(project, loc.trackIndex, {
      ...loc.track,
      items: loc.track.items.filter((it) => it.id !== itemId),
    })
  );

  // Reorder within / into the main track.
  if (destination.track.kind === 'main' && isMediaItem(item)) {
    const index = mainInsertIndex(project, frame, [itemId]);
    // The 60 s budget is measured without the clip itself.
    return insertMain(without, item, index);
  }

  const placed = clampStartToCap({ ...item, from: frame });
  let moved = placed.item;
  if (loc.track.kind === 'main' && isMediaItem(moved)) {
    const { transitionIn: _dropped, ...rest } = moved;
    moved = {
      ...rest,
      transform: { ...moved.transform, widthPct: Math.min(moved.transform.widthPct, 60) },
    } as MediaItem;
  }
  const result = placeOnFreeTrack(without, moved, destination.track.id);
  if (typeof result === 'string') return fail(project, result);
  return done(normalizeProject(result.project), { clamped: placed.clamped, itemIds: [itemId] });
}

// ─── Trim ───────────────────────────────────────────────────────────────────

function neighbourBounds(track: VideoTrack, item: VideoItem): { before: number; after: number } {
  if (track.kind === 'main') return { before: 0, after: Number.POSITIVE_INFINITY };
  let before = 0;
  let after = Number.POSITIVE_INFINITY;
  for (const other of track.items) {
    if (other.id === item.id) continue;
    if (itemEnd(other) <= item.from) before = Math.max(before, itemEnd(other));
    else if (other.from >= itemEnd(item)) after = Math.min(after, other.from);
  }
  return { before, after };
}

/**
 * Move the start or end edge of an item to `toFrame` (absolute). On the main track the clip's
 * left edge stays put (magnetic) and later clips ripple; on free tracks the clip moves.
 * Extending is limited by source length, the 60 s cap and (free tracks) the neighbouring clip.
 */
export function trimItem(
  project: VideoProjectV2,
  itemId: string,
  edge: 'start' | 'end',
  toFrame: number
): OpResult {
  const loc = findItem(project, itemId);
  if (!loc) return fail(project, 'not_found');
  if (loc.track.locked) return fail(project, 'locked');
  const item = loc.item;
  const isMain = loc.track.kind === 'main';
  const bounds = neighbourBounds(loc.track, item);
  const rate = isMediaItem(item) ? (item.playbackRate ?? 1) : 1;
  const hasSource = item.type === 'video' || item.type === 'audio';
  const trimBefore = hasSource ? ((item as MediaItem | AudioItem).trimBeforeFrames ?? 0) : 0;
  const target = Math.round(toFrame);
  const growthRoom = isMain
    ? mainRoomFrames(project)
    : Math.min(maxDurationFrames - itemEnd(item), bounds.after - itemEnd(item));
  let clamped = false;
  let next: VideoItem;

  if (edge === 'end') {
    let duration = target - item.from;
    const maxBySource = maxItemDurationFrames(item, project.fps);
    const max = Math.min(item.durationInFrames + Math.max(0, growthRoom), maxBySource);
    if (duration > max) {
      duration = max;
      clamped = true;
    }
    if (duration < minItemFrames) {
      duration = minItemFrames;
      clamped = true;
    }
    next = { ...item, durationInFrames: Math.round(duration) };
  } else {
    // delta > 0 shortens from the left, delta < 0 reveals earlier source / earlier time.
    let delta = target - item.from;
    const maxDelta = item.durationInFrames - minItemFrames;
    let minDelta = Number.NEGATIVE_INFINITY;
    if (hasSource) minDelta = Math.max(minDelta, -timelineFramesForSource(trimBefore, rate));
    if (isMain) {
      minDelta = Math.max(minDelta, -Math.max(0, growthRoom));
    } else {
      minDelta = Math.max(minDelta, -item.from, bounds.before - item.from);
    }
    if (delta > maxDelta) {
      delta = maxDelta;
      clamped = true;
    }
    if (delta < minDelta) {
      delta = minDelta;
      clamped = true;
    }
    delta = Math.round(delta);
    const updated: VideoItem = {
      ...item,
      durationInFrames: item.durationInFrames - delta,
      from: isMain ? item.from : item.from + delta,
    };
    if (hasSource) {
      (updated as MediaItem | AudioItem).trimBeforeFrames = Math.max(
        0,
        trimBefore + sourceFramesForTimeline(delta, rate)
      );
    }
    next = updated;
  }

  if (isAudioItem(next)) next = fitAudioFades(next);
  const items = loc.track.items.map((it) => (it.id === itemId ? next : it));
  const result = normalizeProject(withTrack(project, loc.trackIndex, { ...loc.track, items }));
  return done(result, { clamped, itemIds: [itemId] });
}

// ─── Split / duplicate / paste ──────────────────────────────────────────────

function splitOne(item: VideoItem, frame: number): [VideoItem, VideoItem] | null {
  const firstDuration = frame - item.from;
  const secondDuration = itemEnd(item) - frame;
  if (firstDuration < minItemFrames || secondDuration < minItemFrames) return null;

  const first: VideoItem = { ...item, durationInFrames: firstDuration };
  const second: VideoItem = {
    ...item,
    id: newId('item'),
    from: frame,
    durationInFrames: secondDuration,
  };

  if (isMediaItem(item) && item.type === 'video') {
    const rate = item.playbackRate ?? 1;
    (second as MediaItem).trimBeforeFrames =
      (item.trimBeforeFrames ?? 0) + sourceFramesForTimeline(firstDuration, rate);
  }
  if (isMediaItem(item)) delete (second as MediaItem).transitionIn;

  if (isAudioItem(item)) {
    (second as AudioItem).trimBeforeFrames =
      (item.trimBeforeFrames ?? 0) + sourceFramesForTimeline(firstDuration, 1);
    (first as AudioItem).fadeOutFrames = 0;
    (second as AudioItem).fadeInFrames = 0;
    (second as AudioItem).fadeOutFrames = item.fadeOutFrames ?? 0;
  }
  if (isLayerItem(item)) {
    (second as typeof item).layer = { ...item.layer, id: newId('layer') };
    delete (first as typeof item).animationOut;
    delete (second as typeof item).animationIn;
  }
  return [first, second];
}

/** Split the given items at `frame`. Items the frame does not cut through are skipped. */
export function splitItems(project: VideoProjectV2, ids: string[], frame: number): OpResult {
  const at = Math.round(frame);
  let working = project;
  const created: string[] = [];
  let blocked = false;

  for (const id of ids) {
    const loc = findItem(working, id);
    if (!loc) continue;
    if (loc.track.locked) {
      blocked = true;
      continue;
    }
    if (!(at > loc.item.from && at < itemEnd(loc.item))) continue;
    if (countItems(working) >= maxItems) return fail(project, 'item_limit');
    const parts = splitOne(loc.item, at);
    if (!parts) continue;
    const items = loc.track.items.slice();
    items.splice(loc.itemIndex, 1, parts[0], parts[1]);
    working = normalizeProject(withTrack(working, loc.trackIndex, { ...loc.track, items }));
    created.push(parts[1].id);
  }
  if (created.length === 0) return fail(project, blocked ? 'locked' : 'invalid');
  return done(working, { itemIds: created });
}

function copyOf(item: VideoItem): VideoItem {
  const copy: VideoItem = { ...item, id: newId('item') };
  if (isLayerItem(copy) && isLayerItem(item)) copy.layer = { ...item.layer, id: newId('layer') };
  return copy;
}

export function duplicateItem(project: VideoProjectV2, itemId: string): OpResult {
  const loc = findItem(project, itemId);
  if (!loc) return fail(project, 'not_found');
  if (loc.track.locked) return fail(project, 'locked');
  if (countItems(project) >= maxItems) return fail(project, 'item_limit');

  const copy = copyOf(loc.item);
  if (loc.track.kind === 'main' && isMediaItem(copy)) {
    const { transitionIn: _dropped, ...rest } = copy;
    return insertMain(project, rest as MediaItem, loc.itemIndex + 1);
  }
  copy.from = itemEnd(loc.item);
  if (itemEnd(copy) > maxDurationFrames) return fail(project, 'duration_limit');
  const placed = placeOnFreeTrack(project, copy, loc.track.id);
  if (typeof placed === 'string') return fail(project, placed);
  return done(normalizeProject(placed.project), { itemIds: [copy.id] });
}

export type ClipboardEntry = { item: VideoItem; trackKind: VideoTrackKind };

/** Paste copies of `entries` starting at `atFrame`, keeping offsets and track kinds. */
export function pasteItems(
  project: VideoProjectV2,
  entries: ClipboardEntry[],
  atFrame: number
): OpResult {
  if (entries.length === 0) return fail(project, 'invalid');
  const origin = Math.min(...entries.map((entry) => entry.item.from));
  let working = project;
  const ids: string[] = [];
  let clamped = false;
  for (const entry of entries.slice().sort((a, b) => a.item.from - b.item.from)) {
    const copy = copyOf(entry.item);
    copy.from = Math.max(0, atFrame + (entry.item.from - origin));
    if (isMediaItem(copy)) delete copy.transitionIn;
    const result = insertItem(working, copy, { kind: entry.trackKind, atFrame: copy.from });
    if (!result.ok) return fail(project, result.reason ?? 'invalid');
    working = result.project;
    clamped = clamped || Boolean(result.clamped);
    ids.push(copy.id);
  }
  return done(working, { itemIds: ids, clamped });
}

// ─── Property updates ───────────────────────────────────────────────────────

/**
 * Update non-timing properties. Identity and timing (`id`, `type`, `from`, `durationInFrames`)
 * are restored after the updater runs, so callers cannot break layout by accident.
 */
export function updateItem(
  project: VideoProjectV2,
  itemId: string,
  updater: (item: VideoItem) => VideoItem
): OpResult {
  const loc = findItem(project, itemId);
  if (!loc) return fail(project, 'not_found');
  if (loc.track.locked) return fail(project, 'locked');
  let next = {
    ...updater(loc.item),
    id: loc.item.id,
    type: loc.item.type,
    from: loc.item.from,
    durationInFrames: loc.item.durationInFrames,
  } as VideoItem;
  if (isAudioItem(next)) next = fitAudioFades(next);
  const items = loc.track.items.map((it) => (it.id === itemId ? next : it));
  return done(normalizeProject(withTrack(project, loc.trackIndex, { ...loc.track, items })), {
    itemIds: [itemId],
  });
}

/** Change video speed, keeping the same span of source footage. */
export function setPlaybackRate(
  project: VideoProjectV2,
  itemId: string,
  rate: VideoPlaybackRate
): OpResult {
  const loc = findItem(project, itemId);
  if (!loc) return fail(project, 'not_found');
  if (loc.track.locked) return fail(project, 'locked');
  const item = loc.item;
  if (item.type !== 'video') return fail(project, 'incompatible');
  const oldRate = item.playbackRate ?? 1;
  const wanted = Math.max(minItemFrames, Math.round((item.durationInFrames * oldRate) / rate));
  const room =
    loc.track.kind === 'main'
      ? mainRoomFrames(project)
      : Math.min(
          maxDurationFrames - itemEnd(item),
          neighbourBounds(loc.track, item).after - itemEnd(item)
        );
  const duration = Math.min(wanted, item.durationInFrames + Math.max(0, room));
  const next: MediaItem = { ...item, playbackRate: rate, durationInFrames: duration };
  const items = loc.track.items.map((it) => (it.id === itemId ? next : it));
  return done(normalizeProject(withTrack(project, loc.trackIndex, { ...loc.track, items })), {
    clamped: duration !== wanted,
    itemIds: [itemId],
  });
}

/** Set the transition into a main-track clip (never the first). `none` removes it. */
export function setTransition(
  project: VideoProjectV2,
  itemId: string,
  type: VideoTransition,
  durationInFrames: number = transitionFrames
): OpResult {
  const loc = findItem(project, itemId);
  if (!loc || loc.track.kind !== 'main' || !isMediaItem(loc.item)) {
    return fail(project, loc ? 'incompatible' : 'not_found');
  }
  if (loc.track.locked) return fail(project, 'locked');
  if (loc.itemIndex === 0) return fail(project, 'invalid');
  const { transitionIn: _previous, ...rest } = loc.item;
  const next: MediaItem =
    type === 'none'
      ? rest
      : {
          ...rest,
          transitionIn: { type, durationInFrames: Math.max(1, Math.round(durationInFrames)) },
        };
  const items = loc.track.items.map((it) => (it.id === itemId ? next : it));
  const result = normalizeProject(withTrack(project, 0, { ...loc.track, items }));
  // A shorter overlap lengthens the main track; refuse when the 60 s cap would then cut a clip.
  const sum = (project: VideoProjectV2) =>
    mainTrackOf(project).items.reduce((n, it) => n + it.durationInFrames, 0);
  if (sum(result) !== sum(project)) return fail(project, 'duration_limit');
  return done(result, { itemIds: [itemId] });
}

// ─── Tracks ─────────────────────────────────────────────────────────────────

export function addTrack(project: VideoProjectV2, kind: Exclude<VideoTrackKind, 'main'>): OpResult {
  if (project.tracks.length >= maxTracks) return fail(project, 'track_limit');
  const tracks = project.tracks.slice();
  tracks.splice(newTrackIndex(tracks, kind), 0, createTrack(kind));
  return done({ ...project, tracks });
}

export function removeEmptyTracks(project: VideoProjectV2): VideoProjectV2 {
  const tracks = project.tracks.filter((track) => track.kind === 'main' || track.items.length > 0);
  return tracks.length === project.tracks.length ? project : { ...project, tracks };
}/** Reorder a non-main track. `toIndex` is the final index (1 or higher; main stays at 0). */
export function reorderTrack(project: VideoProjectV2, trackId: string, toIndex: number): OpResult {
  const found = findTrack(project, trackId);
  if (!found) return fail(project, 'not_found');
  if (found.track.kind === 'main') return fail(project, 'invalid');
  const to = Math.max(1, Math.min(project.tracks.length - 1, Math.round(toIndex)));
  if (to === found.trackIndex) return done(project);
  const tracks = project.tracks.slice();
  const [moved] = tracks.splice(found.trackIndex, 1);
  tracks.splice(to, 0, moved!);
  return done({ ...project, tracks });
}

export function updateTrack(
  project: VideoProjectV2,
  trackId: string,
  patch: Partial<Pick<VideoTrack, 'hidden' | 'muted' | 'locked' | 'name'>>
): OpResult {
  const found = findTrack(project, trackId);
  if (!found) return fail(project, 'not_found');
  const next = { ...found.track, ...patch };
  if (!next.hidden) delete next.hidden;
  if (!next.muted) delete next.muted;
  if (!next.locked) delete next.locked;
  return done(withTrack(project, found.trackIndex, next));
}

// ─── Snapping ───────────────────────────────────────────────────────────────

const SNAP_GRID_FRAMES = 15;

export type SnapContext = {
  playheadFrame: number;
  excludeIds?: string[];
  /** Include the half-second grid. Default true. */
  grid?: boolean;
};

/** Frames worth snapping to: 0, playhead, and every other item's edges. */
function snapCandidates(project: VideoProjectV2, context: SnapContext): number[] {
  const exclude = new Set(context.excludeIds ?? []);
  const points = new Set<number>([0, Math.max(0, Math.round(context.playheadFrame))]);
  for (const track of project.tracks) {
    for (const item of track.items) {
      if (exclude.has(item.id)) continue;
      points.add(item.from);
      points.add(itemEnd(item));
    }
  }
  return [...points].sort((a, b) => a - b);
}

export type SnapResult = { frame: number; snapped: boolean; target: number | null };

/** Snap `frame` to the nearest candidate within `thresholdFrames`, else to the grid. */
export function snapFrame(
  frame: number,
  candidates: number[],
  thresholdFrames: number,
  options: { grid?: boolean } = {}
): SnapResult {
  let best: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const distance = Math.abs(candidate - frame);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  if (best !== null && bestDistance <= thresholdFrames) {
    return { frame: best, snapped: true, target: best };
  }
  if (options.grid !== false) {
    const grid = Math.round(frame / SNAP_GRID_FRAMES) * SNAP_GRID_FRAMES;
    if (Math.abs(grid - frame) <= thresholdFrames) {
      return { frame: grid, snapped: true, target: grid };
    }
  }
  return { frame: Math.round(frame), snapped: false, target: null };
}

/**
 * Snap a moving item: try its start edge and its end edge, keep whichever snaps closest.
 * Returns the adjusted start frame.
 */
export function snapMove(
  project: VideoProjectV2,
  item: Pick<VideoItem, 'id' | 'durationInFrames'>,
  proposedFrom: number,
  context: SnapContext,
  thresholdFrames: number
): SnapResult {
  const candidates = snapCandidates(project, {
    ...context,
    excludeIds: [item.id, ...(context.excludeIds ?? [])],
  });
  const start = snapFrame(proposedFrom, candidates, thresholdFrames, { grid: context.grid });
  const end = snapFrame(proposedFrom + item.durationInFrames, candidates, thresholdFrames, {
    grid: false,
  });
  const startDistance = start.snapped
    ? Math.abs(start.frame - proposedFrom)
    : Number.POSITIVE_INFINITY;
  const endDistance = end.snapped
    ? Math.abs(end.frame - item.durationInFrames - proposedFrom)
    : Number.POSITIVE_INFINITY;
  if (!start.snapped && !end.snapped) {
    return { frame: Math.round(proposedFrom), snapped: false, target: null };
  }
  if (endDistance < startDistance) {
    return {
      frame: Math.max(0, end.frame - item.durationInFrames),
      snapped: true,
      target: end.target,
    };
  }
  return start;
}
