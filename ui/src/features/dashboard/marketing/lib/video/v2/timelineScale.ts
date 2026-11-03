/**
 * Pure timeline geometry: zoom, frame/pixel conversion, ruler ticks, the visible window for
 * virtualization, and lane hit-testing. No DOM access.
 */

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 8;
const ZOOM_STEP = 1.5;
/** Minimum pixels between two ruler labels. */
const MIN_LABEL_GAP_PX = 64;

export const clampZoom = (zoom: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/** Pixels per frame that make the whole project exactly fill `viewportPx` (zoom 1). */
export function fitPxPerFrame(viewportPx: number, projectFrames: number): number {
  if (viewportPx <= 0 || projectFrames <= 0) return 1;
  return viewportPx / projectFrames;
}

export function frameToPx(frame: number, pxPerFrame: number): number {
  return frame * pxPerFrame;
}

export function pxToFrame(px: number, pxPerFrame: number): number {
  return pxPerFrame > 0 ? px / pxPerFrame : 0;
}

export function stepZoom(zoom: number, direction: 1 | -1): number {
  return clampZoom(direction > 0 ? zoom * ZOOM_STEP : zoom / ZOOM_STEP);
}

/**
 * Keep the frame under `anchorPx` (a viewport x) fixed while zooming from `oldPx` to `newPx`.
 * Returns the new scrollLeft.
 */
export function scrollAfterZoom(
  scrollLeft: number,
  anchorPx: number,
  oldPxPerFrame: number,
  newPxPerFrame: number
): number {
  const frameUnderAnchor = pxToFrame(scrollLeft + anchorPx, oldPxPerFrame);
  return Math.max(0, frameToPx(frameUnderAnchor, newPxPerFrame) - anchorPx);
}

export type RulerTick = { frame: number; label: string | null; major: boolean };

const SECOND_STEPS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60];

/** The smallest "nice" time step whose labels stay at least `MIN_LABEL_GAP_PX` apart. */
export function rulerStepSeconds(pxPerFrame: number, fps: number): number {
  const pxPerSecond = pxPerFrame * fps;
  return SECOND_STEPS.find((step) => step * pxPerSecond >= MIN_LABEL_GAP_PX) ?? 60;
}

function tickLabel(seconds: number, step: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  const text =
    step < 1 ? rest.toFixed(1).padStart(4, '0') : String(Math.round(rest)).padStart(2, '0');
  return `${minutes}:${text}`;
}

/** Ticks for the frame range [startFrame, endFrame]; each labelled tick is major. */
export function rulerTicks(
  pxPerFrame: number,
  fps: number,
  startFrame: number,
  endFrame: number
): RulerTick[] {
  const step = rulerStepSeconds(pxPerFrame, fps);
  const stepFrames = Math.max(1, Math.round(step * fps));
  const first = Math.max(0, Math.floor(startFrame / stepFrames) * stepFrames);
  const ticks: RulerTick[] = [];
  for (let frame = first; frame <= endFrame; frame += stepFrames) {
    ticks.push({ frame, label: tickLabel(frame / fps, step), major: true });
    // Half-step minor tick for orientation.
    const minor = frame + stepFrames / 2;
    if (minor <= endFrame) ticks.push({ frame: minor, label: null, major: false });
  }
  return ticks;
}

/** Frames visible in the scroll viewport, widened by `overscanPx` so fast scrolls do not pop. */
export function visibleFrameRange(
  scrollLeft: number,
  viewportPx: number,
  pxPerFrame: number,
  overscanPx = 240
): { start: number; end: number } {
  return {
    start: Math.max(0, Math.floor(pxToFrame(scrollLeft - overscanPx, pxPerFrame))),
    end: Math.ceil(pxToFrame(scrollLeft + viewportPx + overscanPx, pxPerFrame)),
  };
}

export type LaneRect = { id: string; top: number; height: number };

/** Lane under a y coordinate (relative to the lanes container), or the nearest one when between. */
export function laneAtY(lanes: LaneRect[], y: number): LaneRect | null {
  if (lanes.length === 0) return null;
  const hit = lanes.find((lane) => y >= lane.top && y < lane.top + lane.height);
  if (hit) return hit;
  return lanes.reduce((best, lane) => {
    const distance = Math.min(Math.abs(y - lane.top), Math.abs(y - (lane.top + lane.height)));
    const bestDistance = Math.min(Math.abs(y - best.top), Math.abs(y - (best.top + best.height)));
    return distance < bestDistance ? lane : best;
  });
}

/** Pixel threshold converted to frames for snapping (about 8 px, at least 1 frame). */
export function snapThresholdFrames(pxPerFrame: number, thresholdPx = 8): number {
  return Math.max(1, Math.round(pxToFrame(thresholdPx, pxPerFrame)));
}

/** Scroll position that brings `frame` into the middle third of the viewport, or null if visible. */
export function scrollToReveal(
  frame: number,
  scrollLeft: number,
  viewportPx: number,
  pxPerFrame: number
): number | null {
  const x = frameToPx(frame, pxPerFrame);
  const margin = viewportPx * 0.15;
  if (x >= scrollLeft + margin && x <= scrollLeft + viewportPx - margin) return null;
  return Math.max(0, x - viewportPx / 2);
}

/** Total content width: the project plus 30% headroom (or the viewport, whichever is wider). */
export function timelineContentWidth(
  projectFrames: number,
  pxPerFrame: number,
  viewportPx: number
): number {
  return Math.max(viewportPx, Math.ceil(frameToPx(projectFrames * 1.3 + 30, pxPerFrame)));
}
