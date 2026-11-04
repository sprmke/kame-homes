import { describe, expect, it } from 'vitest';

import {
  clampZoom,
  fitPxPerFrame,
  frameToPx,
  laneAtY,
  MAX_ZOOM,
  MIN_ZOOM,
  pxToFrame,
  rulerStepSeconds,
  rulerTicks,
  scrollAfterZoom,
  scrollToReveal,
  snapThresholdFrames,
  stepZoom,
  timelineContentWidth,
  visibleFrameRange,
} from '@/features/dashboard/marketing/lib/video/v2/timelineScale';

describe('zoom and conversions', () => {
  it('fits the project to the viewport and converts both ways', () => {
    expect(fitPxPerFrame(900, 450)).toBe(2);
    expect(fitPxPerFrame(0, 450)).toBe(1);
    expect(fitPxPerFrame(900, 0)).toBe(1);
    expect(pxToFrame(frameToPx(120, 2.5), 2.5)).toBe(120);
    expect(pxToFrame(10, 0)).toBe(0);
  });

  it('clamps and steps zoom within bounds', () => {
    expect(clampZoom(100)).toBe(MAX_ZOOM);
    expect(clampZoom(0)).toBe(MIN_ZOOM);
    expect(stepZoom(1, 1)).toBe(1.5);
    expect(stepZoom(1, -1)).toBeCloseTo(1 / 1.5);
    expect(stepZoom(MAX_ZOOM, 1)).toBe(MAX_ZOOM);
    expect(stepZoom(MIN_ZOOM, -1)).toBe(MIN_ZOOM);
  });

  it('keeps the frame under the cursor still while zooming', () => {
    const before = 2;
    const after = 4;
    const scrollLeft = 300;
    const anchor = 200;
    const next = scrollAfterZoom(scrollLeft, anchor, before, after);
    expect(pxToFrame(next + anchor, after)).toBeCloseTo(pxToFrame(scrollLeft + anchor, before));
    expect(scrollAfterZoom(0, 0, 2, 0.5)).toBe(0);
  });
});

describe('ruler', () => {
  it('picks a nice step so labels never crowd', () => {
    expect(rulerStepSeconds(10, 30)).toBe(0.25); // 300 px per second
    expect(rulerStepSeconds(2, 30)).toBe(2); // 60 px per second is too tight for 1 s labels
    expect(rulerStepSeconds(3, 30)).toBe(1);
    expect(rulerStepSeconds(0.2, 30)).toBe(15);
    expect(rulerStepSeconds(0.001, 30)).toBe(60);
    for (const px of [0.05, 0.3, 1, 3, 9, 40]) {
      const step = rulerStepSeconds(px, 30);
      expect(step * px * 30 >= 64 || step === 60).toBe(true);
    }
  });

  it('labels whole seconds as m:ss and sub-seconds with a tenth', () => {
    const ticks = rulerTicks(2, 30, 0, 200);
    expect(ticks.filter((t) => t.major).map((t) => t.label)).toEqual([
      '0:00',
      '0:02',
      '0:04',
      '0:06',
    ]);
    expect(ticks.some((t) => !t.major && t.label === null)).toBe(true);
    const fine = rulerTicks(20, 30, 0, 60);
    expect(fine[0]!.label).toBe('0:00.0');
    expect(rulerTicks(2, 30, 700, 900)[0]!.frame).toBeGreaterThanOrEqual(660);
    expect(rulerTicks(2, 30, 1790, 1800).every((t) => t.frame <= 1800)).toBe(true);
  });
});

describe('virtualization and scrolling', () => {
  it('computes the visible window with overscan, never below 0', () => {
    expect(visibleFrameRange(0, 600, 2, 100)).toEqual({ start: 0, end: 350 });
    expect(visibleFrameRange(1000, 600, 2, 100)).toEqual({ start: 450, end: 850 });
  });

  it('reveals a frame only when it is outside the comfortable middle', () => {
    expect(scrollToReveal(100, 0, 600, 2)).toBeNull();
    expect(scrollToReveal(300, 0, 600, 2)).toBe(300);
    expect(scrollToReveal(600, 0, 600, 2)).toBe(900);
    expect(scrollToReveal(10, 800, 600, 2)).toBe(0);
  });

  it('sizes the content with headroom and never below the viewport', () => {
    expect(timelineContentWidth(100, 1, 600)).toBe(600);
    expect(timelineContentWidth(1000, 1, 600)).toBe(1330);
  });

  it('turns a pixel threshold into at least one frame', () => {
    expect(snapThresholdFrames(2)).toBe(4);
    expect(snapThresholdFrames(100)).toBe(1);
  });
});

describe('laneAtY', () => {
  const lanes = [
    { id: 'a', top: 0, height: 40 },
    { id: 'b', top: 44, height: 40 },
  ];
  it('hits a lane, snaps to the nearest between lanes and handles none', () => {
    expect(laneAtY(lanes, 10)?.id).toBe('a');
    expect(laneAtY(lanes, 60)?.id).toBe('b');
    expect(laneAtY(lanes, 42)?.id).toBe('a');
    expect(laneAtY(lanes, 43)?.id).toBe('b');
    expect(laneAtY(lanes, 500)?.id).toBe('b');
    expect(laneAtY(lanes, -50)?.id).toBe('a');
    expect(laneAtY([], 5)).toBeNull();
  });
});
