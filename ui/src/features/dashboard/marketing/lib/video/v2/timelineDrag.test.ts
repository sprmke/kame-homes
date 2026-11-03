import { describe, expect, it } from 'vitest';

import {
  commitDrag,
  DRAG_START_PX,
  resolveDrag,
  resolveMediaDrop,
  type DragContext,
  type DragStart,
} from '@/features/dashboard/marketing/lib/video/v2/timelineDrag';
import {
  normalizeProject,
  validateProject,
} from '@/features/dashboard/marketing/lib/video/v2/timelineOps';
import { mainTrackOf } from '@/features/dashboard/marketing/lib/video/v2/timelineTiming';
import {
  caption,
  clip,
  photo,
  project,
  track,
} from '@/features/dashboard/marketing/lib/video/v2/videoV2Fixtures';

const a = photo(90);
const b = photo(90);
const c = clip(120, 20);
const cap = caption(30, 60);
const mainId = 'main-track';
const textId = 'text-track';
const base = normalizeProject(
  project([
    { ...track('main', [a, b, c]), id: mainId },
    { ...track('text', [cap]), id: textId },
  ])
);
// 2 px per frame; main lane 0-56, text lane 60-96.
const ctx = (over: Partial<DragContext> = {}): DragContext => ({
  pxPerFrame: 2,
  lanes: [
    { id: mainId, top: 0, height: 56 },
    { id: textId, top: 60, height: 36 },
  ],
  snapEnabled: false,
  playheadFrame: 0,
  thresholdFrames: 4,
  ...over,
});
const start = (over: Partial<DragStart>): DragStart => ({
  mode: 'move',
  itemId: cap.id,
  startX: 100,
  startY: 70,
  originFrom: 30,
  originDuration: 60,
  originTrackId: textId,
  ...over,
});

describe('resolveDrag', () => {
  it('treats small pointer travel as a click', () => {
    const p = resolveDrag(base, start({}), { x: 100 + DRAG_START_PX - 1, y: 70 }, ctx());
    expect(p.active).toBe(false);
    expect(p.from).toBe(30);
  });

  it('moves by the pointer delta in frames', () => {
    const p = resolveDrag(base, start({}), { x: 140, y: 70 }, ctx());
    expect(p).toMatchObject({ active: true, from: 50, trackId: textId, reorderMain: false });
    expect(resolveDrag(base, start({}), { x: -500, y: 70 }, ctx()).from).toBe(0);
  });

  it('snaps to neighbouring edges, the playhead and the grid when enabled', () => {
    const snapped = resolveDrag(
      base,
      start({}),
      { x: 100 + 2 * 59, y: 70 },
      ctx({ snapEnabled: true, playheadFrame: 90 })
    );
    expect(snapped.from).toBe(90); // 89 snaps to the playhead / clip edge at 90
    expect(snapped.snapTarget).toBe(90);
    const off = resolveDrag(base, start({}), { x: 100 + 2 * 59, y: 70 }, ctx());
    expect(off.from).toBe(89);
  });

  it('chooses the lane under the pointer and flags main reorders', () => {
    const toMain = resolveDrag(base, start({}), { x: 130, y: 20 }, ctx());
    expect(toMain.trackId).toBe(mainId);
    expect(toMain.reorderMain).toBe(true);
    expect(toMain.mainIndex).toBeGreaterThanOrEqual(0);
  });

  it('trims the end and start, enforcing a positive length', () => {
    const end = resolveDrag(base, start({ mode: 'trim-end' }), { x: 160, y: 70 }, ctx());
    expect(end).toMatchObject({ from: 30, durationInFrames: 90 });
    const startEdge = resolveDrag(base, start({ mode: 'trim-start' }), { x: 120, y: 70 }, ctx());
    expect(startEdge).toMatchObject({ from: 40, durationInFrames: 50 });
    expect(
      resolveDrag(base, start({ mode: 'trim-end' }), { x: -9999, y: 70 }, ctx()).durationInFrames
    ).toBe(1);
    expect(
      resolveDrag(base, start({ mode: 'trim-start' }), { x: 9999, y: 70 }, ctx()).durationInFrames
    ).toBe(1);
  });
});

describe('commitDrag', () => {
  it('does nothing for a click', () => {
    const preview = resolveDrag(base, start({}), { x: 101, y: 70 }, ctx());
    expect(commitDrag(base, start({}), preview).ok).toBe(false);
  });

  it('moves a caption and keeps the project valid', () => {
    const s = start({});
    const result = commitDrag(base, s, resolveDrag(base, s, { x: 200, y: 70 }, ctx()));
    expect(result.ok).toBe(true);
    expect(result.project.tracks[1]!.items[0]!.from).toBe(80);
    expect(validateProject(result.project)).toEqual([]);
  });

  it('reorders main clips by dropping past the next clip', () => {
    const s = start({
      itemId: a.id,
      startX: 20,
      startY: 20,
      originFrom: 0,
      originDuration: 90,
      originTrackId: mainId,
    });
    // Drag far right: after b.
    const preview = resolveDrag(base, s, { x: 20 + 2 * 150, y: 20 }, ctx());
    const result = commitDrag(base, s, preview);
    expect(result.ok).toBe(true);
    expect(mainTrackOf(result.project).items.map((i) => i.id)).toEqual([b.id, a.id, c.id]);
    expect(validateProject(result.project)).toEqual([]);
  });

  it('trims through the ops (video start trim advances trimBefore)', () => {
    const s = start({
      itemId: c.id,
      mode: 'trim-start',
      originFrom: 180,
      originDuration: 120,
      originTrackId: mainId,
      startX: 360,
      startY: 20,
    });
    const result = commitDrag(base, s, resolveDrag(base, s, { x: 360 + 2 * 30, y: 20 }, ctx()));
    const out = mainTrackOf(result.project).items.at(-1) as unknown as {
      durationInFrames: number;
      trimBeforeFrames: number;
    };
    expect(out.durationInFrames).toBe(90);
    expect(out.trimBeforeFrames).toBe(30);
  });

  it('reports a missing item', () => {
    const s = start({ itemId: 'gone' });
    expect(commitDrag(base, s, { ...resolveDrag(base, s, { x: 300, y: 70 }, ctx()) }).reason).toBe(
      'not_found'
    );
  });
});

describe('resolveMediaDrop', () => {
  it('converts x to a frame and picks the lane', () => {
    const drop = resolveMediaDrop(base, { xInTimeline: 100, yInLanes: 70 }, ctx());
    expect(drop).toEqual({ frame: 50, trackId: textId, onMain: false });
    expect(resolveMediaDrop(base, { xInTimeline: 100, yInLanes: 10 }, ctx()).onMain).toBe(true);
    expect(resolveMediaDrop(base, { xInTimeline: -40, yInLanes: 10 }, ctx()).frame).toBe(0);
  });

  it('snaps to clip edges and the playhead', () => {
    const drop = resolveMediaDrop(
      base,
      { xInTimeline: 2 * 88, yInLanes: 10 },
      ctx({ snapEnabled: true })
    );
    expect(drop.frame).toBe(90);
  });
});
