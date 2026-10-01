/**
 * AI mode canvas pane width (desktop, lg+). Resizable 560px … 60vw; default clamp(560, 55vw, 900).
 * Pages use viewport breakpoints, so the pane never goes below the width their desktop layouts
 * (two-pane inbox, settings nav, templates) still fit in. On small laptops the rail collapses
 * instead (railMustCollapse) so the chat column keeps CHAT_MIN_PX.
 */

export const CANVAS_MIN_PX = 560;
const CANVAS_MAX_VW = 0.6;
const CANVAS_DEFAULT_VW = 0.55;
const CANVAS_DEFAULT_MAX_PX = 900;
/** Keeps the chat column usable next to the canvas. */
export const CHAT_MIN_PX = 360;
/** Matches AiModeRail's animated width: icon column + chats panel. */
export const RAIL_EXPANDED_PX = 300;
export const RAIL_COLLAPSED_PX = 64;
/** Resize gutter + canvas inset. */
const GUTTER_PX = 16;
const STORAGE_KEY = 'kame-ai-canvas-width';

/**
 * True when the expanded rail would leave the canvas under CANVAS_MIN_PX next to the chat
 * (viewports below 1236px). The rail then stays collapsed while the canvas is open.
 */
export function railMustCollapse(viewportWidth: number): boolean {
  return viewportWidth - RAIL_EXPANDED_PX - GUTTER_PX - CHAT_MIN_PX < CANVAS_MIN_PX;
}

export function defaultCanvasWidth(viewportWidth: number, railPx = RAIL_EXPANDED_PX): number {
  return clampCanvasWidth(
    Math.min(CANVAS_DEFAULT_MAX_PX, Math.round(viewportWidth * CANVAS_DEFAULT_VW)),
    viewportWidth,
    railPx
  );
}

export function clampCanvasWidth(
  px: number,
  viewportWidth: number,
  railPx = RAIL_EXPANDED_PX
): number {
  // 60vw, but never so wide that the chat column drops below CHAT_MIN_PX; the minimum wins ties.
  const roomLeft = viewportWidth - railPx - GUTTER_PX - CHAT_MIN_PX;
  const max = Math.max(
    CANVAS_MIN_PX,
    Math.min(Math.round(viewportWidth * CANVAS_MAX_VW), roomLeft)
  );
  if (!Number.isFinite(px)) return CANVAS_MIN_PX;
  return Math.min(max, Math.max(CANVAS_MIN_PX, Math.round(px)));
}

/**
 * Size bucket for the canvas pane. Inside the pane `lg:` still thinks the page is desktop-wide,
 * so index.css collapses 3–5 column grids on `medium` panes (`data-canvas-size`). Plain
 * attributes instead of CSS container queries: containment would trap in-page
 * `position: fixed` overlays inside the pane.
 */
export type CanvasSize = 'medium' | 'wide';

export function canvasSizeBucket(px: number): CanvasSize {
  return px < 760 ? 'medium' : 'wide';
}

/** The host's saved width (unclamped); NaN when none is saved. */
export function readCanvasWidth(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw == null ? Number.NaN : Number(raw);
  } catch {
    return Number.NaN;
  }
}

export function writeCanvasWidth(px: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Math.round(px)));
  } catch {
    // Per-viewer convenience only.
  }
}
