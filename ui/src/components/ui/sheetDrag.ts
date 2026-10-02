/** Downward drag distance (px) past which a release dismisses the sheet. */
export const SHEET_DRAG_CLOSE_DISTANCE = 120;
/** Downward flick velocity (px/s) past which a release dismisses regardless of distance. */
export const SHEET_DRAG_CLOSE_VELOCITY = 700;

/**
 * Bottom-anchored sheet: dragging down shrinks height 1:1 so the top edge
 * follows the pointer. Upward movement does not grow the sheet.
 */
export function sheetHeightForDrag(startHeight: number, deltaY: number): number {
  if (!Number.isFinite(startHeight) || startHeight <= 0) return 0;
  const downward = Number.isFinite(deltaY) ? Math.max(0, deltaY) : 0;
  return Math.max(0, startHeight - downward);
}

export function shouldDismissSheetDrag(deltaY: number, velocityY: number): boolean {
  const downward = Number.isFinite(deltaY) ? Math.max(0, deltaY) : 0;
  const velocity = Number.isFinite(velocityY) ? velocityY : 0;
  return downward > SHEET_DRAG_CLOSE_DISTANCE || velocity > SHEET_DRAG_CLOSE_VELOCITY;
}
