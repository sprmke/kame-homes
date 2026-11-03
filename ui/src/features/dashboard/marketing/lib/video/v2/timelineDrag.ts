/**
 * Pure drag resolution for timeline clips. The UI feeds pointer positions in; this returns what
 * the drop would do (preview) and commits it through `timelineOps`. No DOM, no React.
 */

import {
  findItem,
  mainInsertIndex,
  moveItem,
  snapFrame,
  snapMove,
  trimItem,
  type OpResult,
} from '@/features/dashboard/marketing/lib/video/v2/timelineOps';
import {
  laneAtY,
  pxToFrame,
  type LaneRect,
} from '@/features/dashboard/marketing/lib/video/v2/timelineScale';
import { itemEnd, mainTrackOf } from '@/features/dashboard/marketing/lib/video/v2/timelineTiming';
import type { VideoProjectV2 } from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

export type DragMode = 'move' | 'trim-start' | 'trim-end';

export type DragStart = {
  mode: DragMode;
  itemId: string;
  /** Pointer position (viewport px) at pointer down. */
  startX: number;
  startY: number;
  originFrom: number;
  originDuration: number;
  originTrackId: string;
};

export type DragContext = {
  pxPerFrame: number;
  /** Lane rects relative to the lanes container; `y` passed to `resolveDrag` uses the same space. */
  lanes: LaneRect[];
  snapEnabled: boolean;
  playheadFrame: number;
  thresholdFrames: number;
};

export type DragPreview = {
  /** Where the clip start would land (frames). */
  from: number;
  durationInFrames: number;
  /** Lane the clip would end up in (lane ids are track ids). */
  trackId: string;
  /** True when dropping on the main track reorders instead of placing at `from`. */
  reorderMain: boolean;
  /** Insertion index on main (reorder previews). */
  mainIndex: number | null;
  snapTarget: number | null;
  /** The pointer moved far enough to count as a drag (not a click). */
  active: boolean;
};

/** Pointer travel (px) before a press becomes a drag. */
export const DRAG_START_PX = 4;

export function resolveDrag(
  project: VideoProjectV2,
  start: DragStart,
  pointer: { x: number; y: number },
  context: DragContext
): DragPreview {
  const dx = pointer.x - start.startX;
  const dy = pointer.y - start.startY;
  const active = Math.hypot(dx, dy) >= DRAG_START_PX;
  const baseline: DragPreview = {
    from: start.originFrom,
    durationInFrames: start.originDuration,
    trackId: start.originTrackId,
    reorderMain: false,
    mainIndex: null,
    snapTarget: null,
    active,
  };
  if (!active) return baseline;

  const deltaFrames = pxToFrame(dx, context.pxPerFrame);
  const snapOf = (frame: number, edgeOnly = true) =>
    context.snapEnabled
      ? snapFrame(
          frame,
          snapCandidatesFor(project, start.itemId, context),
          context.thresholdFrames,
          {
            grid: !edgeOnly,
          }
        )
      : { frame: Math.round(frame), snapped: false, target: null };

  if (start.mode === 'trim-end') {
    const snapped = snapOf(start.originFrom + start.originDuration + deltaFrames);
    return {
      ...baseline,
      durationInFrames: Math.max(1, snapped.frame - start.originFrom),
      snapTarget: snapped.target,
    };
  }

  if (start.mode === 'trim-start') {
    const snapped = snapOf(start.originFrom + deltaFrames);
    const from = snapped.frame;
    return {
      ...baseline,
      from,
      durationInFrames: Math.max(1, start.originFrom + start.originDuration - from),
      snapTarget: snapped.target,
    };
  }

  // move
  const lane = laneAtY(context.lanes, pointer.y);
  const trackId = lane?.id ?? start.originTrackId;
  const moving = { id: start.itemId, durationInFrames: start.originDuration };
  const proposed = Math.max(0, start.originFrom + deltaFrames);
  const snapped = context.snapEnabled
    ? snapMove(
        project,
        moving,
        proposed,
        { playheadFrame: context.playheadFrame, grid: true },
        context.thresholdFrames
      )
    : { frame: Math.round(proposed), snapped: false, target: null };

  const targetTrack = project.tracks.find((track) => track.id === trackId);
  const reorderMain = targetTrack?.kind === 'main';
  return {
    ...baseline,
    from: snapped.frame,
    trackId,
    reorderMain,
    mainIndex: reorderMain
      ? mainInsertIndex(project, snapped.frame + start.originDuration / 2, [start.itemId])
      : null,
    snapTarget: snapped.target,
  };
}

function snapCandidatesFor(
  project: VideoProjectV2,
  itemId: string,
  context: DragContext
): number[] {
  const points = new Set<number>([0, Math.round(context.playheadFrame)]);
  for (const track of project.tracks) {
    for (const item of track.items) {
      if (item.id === itemId) continue;
      points.add(item.from);
      points.add(itemEnd(item));
    }
  }
  return [...points];
}

/** Apply a resolved drag through the ops. A click (not active) changes nothing. */
export function commitDrag(
  project: VideoProjectV2,
  start: DragStart,
  preview: DragPreview
): OpResult {
  if (!preview.active) return { project, ok: false, reason: 'invalid' };
  const loc = findItem(project, start.itemId);
  if (!loc) return { project, ok: false, reason: 'not_found' };

  switch (start.mode) {
    case 'trim-start':
      return trimItem(project, start.itemId, 'start', preview.from);
    case 'trim-end':
      return trimItem(project, start.itemId, 'end', preview.from + preview.durationInFrames);
    case 'move': {
      const onMain = loc.track.kind === 'main';
      const sameTrack = preview.trackId === start.originTrackId;
      if (onMain && sameTrack) {
        // Reorder: drop position decides the index, so aim at the clip's midpoint.
        return moveItem(project, start.itemId, {
          frame: preview.from + start.originDuration / 2,
          trackId: preview.trackId,
        });
      }
      return moveItem(project, start.itemId, {
        frame: preview.from,
        trackId: preview.trackId,
      });
    }
  }
}

/** Where a media drop lands: frame from x, and the lane (or null = create a new track). */
export function resolveMediaDrop(
  project: VideoProjectV2,
  pointer: { xInTimeline: number; yInLanes: number },
  context: Pick<
    DragContext,
    'pxPerFrame' | 'lanes' | 'snapEnabled' | 'playheadFrame' | 'thresholdFrames'
  >
): { frame: number; trackId: string | null; onMain: boolean } {
  const raw = pxToFrame(pointer.xInTimeline, context.pxPerFrame);
  const candidates = [0, Math.round(context.playheadFrame)];
  for (const track of project.tracks) {
    for (const item of track.items) candidates.push(item.from, itemEnd(item));
  }
  const frame = context.snapEnabled
    ? snapFrame(raw, candidates, context.thresholdFrames, { grid: true }).frame
    : Math.round(raw);
  const lane = laneAtY(context.lanes, pointer.yInLanes);
  const track = lane ? project.tracks.find((t) => t.id === lane.id) : undefined;
  return {
    frame: Math.max(0, frame),
    trackId: track?.id ?? mainTrackOf(project).id,
    onMain: track?.kind === 'main',
  };
}
