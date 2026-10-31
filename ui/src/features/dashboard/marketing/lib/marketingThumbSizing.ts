/** Library cards draw stored thumbnails at up to ~240px CSS width (480 device px). */
export const SAVED_THUMB_LONG_EDGE = 480;

/** Pixel ratio that makes the longer canvas edge `longEdge` pixels (never upscales). */
export function savedThumbnailPixelRatio(
  width: number,
  height: number,
  longEdge = SAVED_THUMB_LONG_EDGE
): number {
  const longest = Math.max(width, height, 1);
  return Math.min(1, Math.max(0.05, longEdge / longest));
}
