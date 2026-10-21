/**
 * UI mirror of `REVIEW_WINDOW_DAYS` in `_shared/reviewWindow.ts`.
 * Display-only — server owns open/close math in Manila.
 */

export const REVIEW_WINDOW_DAYS = 14;

export type ReviewWindowState = 'open' | 'submitted' | 'published' | 'closed' | 'unavailable';

/** Days remaining until `closesAt` (inclusive of today). Null when already closed or missing. */
export function daysLeftInReviewWindow(
  closesAt: string | null | undefined,
  now = new Date()
): number | null {
  if (!closesAt) return null;
  const ms = Date.parse(closesAt) - now.getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.ceil(ms / 86_400_000);
}
