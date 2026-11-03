/**
 * Pure math for direct manipulation of overlay clips on the preview canvas: move with snap
 * guides, uniform resize, rotate. Coordinates are percent of the frame unless noted.
 */

import type { VisualTransform } from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import type { VideoFormat } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';

export type Guide = { axis: 'x' | 'y'; at: number; kind: 'center' | 'edge' | 'safe' };

/** Share of the frame covered by app UI on 9:16 platforms (Stories, Reels). */
const SAFE_AREA = { top: 14, bottom: 20, side: 6 } as const;

/** Safe-area guide lines (percent) for a format. Only 9:16 has UI zones worth marking. */
export function safeAreaGuides(format: VideoFormat): Guide[] {
  if (format !== 'instagram-story') return [];
  return [
    { axis: 'y', at: SAFE_AREA.top, kind: 'safe' },
    { axis: 'y', at: 100 - SAFE_AREA.bottom, kind: 'safe' },
    { axis: 'x', at: SAFE_AREA.side, kind: 'safe' },
    { axis: 'x', at: 100 - SAFE_AREA.side, kind: 'safe' },
  ];
}

const SNAP_PCT = 1.5;

function snapAxis(
  center: number,
  half: number,
  axis: 'x' | 'y',
  enabled: boolean
): { value: number; guide: Guide | null } {
  if (!enabled) return { value: center, guide: null };
  const options: Array<{ at: number; value: number; kind: Guide['kind'] }> = [
    { at: 50, value: 50, kind: 'center' },
    { at: 0, value: half, kind: 'edge' },
    { at: 100, value: 100 - half, kind: 'edge' },
  ];
  // Also snap the box edges to the frame edges (left edge at 0, right edge at 100).
  let best: { distance: number; value: number; guide: Guide } | null = null;
  const edges: Array<[number, number, Guide['kind']]> = [
    [center, 50, 'center'],
    [center - half, 0, 'edge'],
    [center + half, 100, 'edge'],
  ];
  edges.forEach(([measured, target, kind], index) => {
    const distance = Math.abs(measured - target);
    if (distance <= SNAP_PCT && (!best || distance < best.distance)) {
      best = { distance, value: options[index]!.value, guide: { axis, at: target, kind } };
    }
  });
  const found = best as { value: number; guide: Guide } | null;
  return found ? { value: found.value, guide: found.guide } : { value: center, guide: null };
}

export type MoveResult = { x: number; y: number; guides: Guide[] };

/**
 * Move by a pointer delta (already converted to percent of the frame). `halfWidthPct` and
 * `halfHeightPct` are half the box size in percent, used for edge snapping.
 */
export function moveTransform(
  start: Pick<VisualTransform, 'x' | 'y'>,
  deltaXPct: number,
  deltaYPct: number,
  half: { w: number; h: number },
  snap: boolean
): MoveResult {
  const sx = snapAxis(start.x + deltaXPct, half.w, 'x', snap);
  const sy = snapAxis(start.y + deltaYPct, half.h, 'y', snap);
  return {
    x: Math.round(sx.value * 100) / 100,
    y: Math.round(sy.value * 100) / 100,
    guides: [sx.guide, sy.guide].filter((g): g is Guide => g !== null),
  };
}

export const MIN_WIDTH_PCT = 4;
export const MAX_WIDTH_PCT = 300;

/**
 * Width (percent of frame width) after dragging a corner handle. The box is centered, so its
 * width is twice the horizontal distance from center to the pointer in the box's own
 * (unrotated) space.
 */
export function resizedWidthPct(
  centerPx: { x: number; y: number },
  pointerPx: { x: number; y: number },
  rotationDeg: number,
  frameWidthPx: number
): number {
  if (frameWidthPx <= 0) return 100;
  const radians = (-rotationDeg * Math.PI) / 180;
  const dx = pointerPx.x - centerPx.x;
  const dy = pointerPx.y - centerPx.y;
  const unrotatedX = dx * Math.cos(radians) - dy * Math.sin(radians);
  const pct = (Math.abs(unrotatedX) * 2 * 100) / frameWidthPx;
  return Math.round(Math.min(MAX_WIDTH_PCT, Math.max(MIN_WIDTH_PCT, pct)) * 10) / 10;
}

/** Rotation in degrees for a pointer around the center; 0 = handle straight above. */
export function rotationFromPointer(
  centerPx: { x: number; y: number },
  pointerPx: { x: number; y: number },
  snapStep: number | null
): number {
  const degrees = (Math.atan2(pointerPx.x - centerPx.x, centerPx.y - pointerPx.y) * 180) / Math.PI;
  const stepped = snapStep ? Math.round(degrees / snapStep) * snapStep : degrees;
  const normalized = ((((stepped + 180) % 360) + 360) % 360) - 180;
  return Math.round(normalized * 10) / 10;
}

/** Percent delta from a pixel delta in a frame of the given on-screen size. */
export function pxDeltaToPct(deltaPx: number, framePx: number): number {
  return framePx > 0 ? (deltaPx / framePx) * 100 : 0;
}
