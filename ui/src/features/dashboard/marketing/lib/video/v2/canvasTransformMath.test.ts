import { describe, expect, it } from 'vitest';

import {
  MAX_WIDTH_PCT,
  MIN_WIDTH_PCT,
  moveTransform,
  pxDeltaToPct,
  resizedWidthPct,
  rotationFromPointer,
  safeAreaGuides,
} from '@/features/dashboard/marketing/lib/video/v2/canvasTransformMath';

describe('moveTransform', () => {
  const half = { w: 20, h: 10 };

  it('moves freely when snapping is off', () => {
    expect(moveTransform({ x: 30, y: 40 }, 5.123, -3, half, false)).toEqual({
      x: 35.12,
      y: 37,
      guides: [],
    });
  });

  it('snaps the center to the frame center and reports the guide', () => {
    const r = moveTransform({ x: 40, y: 40 }, 9.2, 9.4, half, true);
    expect(r.x).toBe(50);
    expect(r.y).toBe(50);
    expect(r.guides).toEqual([
      { axis: 'x', at: 50, kind: 'center' },
      { axis: 'y', at: 50, kind: 'center' },
    ]);
  });

  it('snaps box edges to the frame edges', () => {
    const left = moveTransform({ x: 30, y: 50 }, -9.5, 0, half, true);
    expect(left.x).toBe(20); // left edge at 0 → center at half width
    expect(left.guides.some((g) => g.axis === 'x' && g.at === 0 && g.kind === 'edge')).toBe(true);
    const right = moveTransform({ x: 70, y: 50 }, 9.5, 0, half, true);
    expect(right.x).toBe(80);
  });

  it('does not snap outside the threshold', () => {
    const r = moveTransform({ x: 30, y: 30 }, 5, 5, half, true);
    expect(r).toEqual({ x: 35, y: 35, guides: [] });
  });
});

describe('resizedWidthPct', () => {
  it('doubles the pointer distance from center into a percentage of the frame', () => {
    expect(resizedWidthPct({ x: 100, y: 100 }, { x: 150, y: 100 }, 0, 200)).toBe(50);
    expect(resizedWidthPct({ x: 100, y: 100 }, { x: 40, y: 100 }, 0, 200)).toBe(60);
  });

  it('measures in the rotated box space', () => {
    // A 90 degree rotated box: horizontal pointer motion maps onto the box height axis.
    const w = resizedWidthPct({ x: 100, y: 100 }, { x: 100, y: 150 }, 90, 200);
    expect(w).toBe(50);
    expect(resizedWidthPct({ x: 100, y: 100 }, { x: 150, y: 100 }, 90, 200)).toBe(MIN_WIDTH_PCT);
  });

  it('clamps to sane bounds and tolerates a zero-size frame', () => {
    expect(resizedWidthPct({ x: 0, y: 0 }, { x: 0, y: 0 }, 0, 200)).toBe(MIN_WIDTH_PCT);
    expect(resizedWidthPct({ x: 0, y: 0 }, { x: 99999, y: 0 }, 0, 200)).toBe(MAX_WIDTH_PCT);
    expect(resizedWidthPct({ x: 0, y: 0 }, { x: 5, y: 5 }, 0, 0)).toBe(100);
  });
});

describe('rotationFromPointer', () => {
  const c = { x: 100, y: 100 };
  it('is 0 straight above, 90 to the right, -90 to the left, 180 below', () => {
    expect(rotationFromPointer(c, { x: 100, y: 50 }, null)).toBe(0);
    expect(rotationFromPointer(c, { x: 150, y: 100 }, null)).toBe(90);
    expect(rotationFromPointer(c, { x: 50, y: 100 }, null)).toBe(-90);
    expect(Math.abs(rotationFromPointer(c, { x: 100, y: 150 }, null))).toBe(180);
  });

  it('snaps to a step when asked and stays within -180..180', () => {
    expect(rotationFromPointer(c, { x: 130, y: 52 }, 15)).toBe(30);
    for (let angle = 0; angle < 360; angle += 17) {
      const rad = (angle * Math.PI) / 180;
      const r = rotationFromPointer(
        c,
        { x: 100 + 50 * Math.sin(rad), y: 100 - 50 * Math.cos(rad) },
        null
      );
      expect(r).toBeGreaterThanOrEqual(-180);
      expect(r).toBeLessThanOrEqual(180);
    }
  });
});

describe('helpers', () => {
  it('shows safe-area guides only for 9:16', () => {
    expect(safeAreaGuides('instagram-story')).toHaveLength(4);
    expect(safeAreaGuides('landscape')).toEqual([]);
    expect(safeAreaGuides('instagram-post')).toEqual([]);
  });

  it('converts pixel deltas to percent safely', () => {
    expect(pxDeltaToPct(50, 200)).toBe(25);
    expect(pxDeltaToPct(50, 0)).toBe(0);
  });
});
