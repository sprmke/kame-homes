import { describe, expect, it } from 'vitest';

import {
  CANVAS_MIN_PX,
  canvasSizeBucket,
  CHAT_MIN_PX,
  clampCanvasWidth,
  defaultCanvasWidth,
  RAIL_COLLAPSED_PX,
  railMustCollapse,
} from '@/features/dashboard/ai-assistant/lib/canvasWidth';

describe('canvas width', () => {
  it('defaults to 55vw capped at 900 (and the chat minimum), floored at 560', () => {
    expect(defaultCanvasWidth(1440)).toBe(764);
    expect(defaultCanvasWidth(2560)).toBe(900);
    expect(defaultCanvasWidth(1024, RAIL_COLLAPSED_PX)).toBe(CANVAS_MIN_PX + 3);
  });

  it('clamps resizes between 560px and 60vw, keeping the chat usable', () => {
    expect(clampCanvasWidth(100, 1440)).toBe(CANVAS_MIN_PX);
    // 60vw = 864, but the chat keeps 360px: 1440 - 300 - 16 - 360 = 764.
    expect(clampCanvasWidth(2000, 1440)).toBe(764);
    // A collapsed rail gives the canvas the difference.
    expect(clampCanvasWidth(2000, 1440, RAIL_COLLAPSED_PX)).toBe(864);
    expect(clampCanvasWidth(2000, 2560)).toBe(1536);
    expect(clampCanvasWidth(600.4, 1440)).toBe(600);
    expect(clampCanvasWidth(Number.NaN, 1440)).toBe(CANVAS_MIN_PX);
  });

  it('collapses the rail on small laptops so the canvas and chat both fit', () => {
    expect(railMustCollapse(1024)).toBe(true);
    expect(railMustCollapse(1235)).toBe(true);
    expect(railMustCollapse(1236)).toBe(false);
    // Every lg viewport then fits the minimum canvas next to the minimum chat.
    const width = clampCanvasWidth(0, 1024, RAIL_COLLAPSED_PX);
    expect(width).toBe(CANVAS_MIN_PX);
    expect(1024 - RAIL_COLLAPSED_PX - 16 - width).toBeGreaterThanOrEqual(CHAT_MIN_PX);
  });

  it('buckets the pane width for the canvas grid overrides', () => {
    expect(canvasSizeBucket(CANVAS_MIN_PX)).toBe('medium');
    expect(canvasSizeBucket(704)).toBe('medium');
    expect(canvasSizeBucket(792)).toBe('wide');
  });
});
