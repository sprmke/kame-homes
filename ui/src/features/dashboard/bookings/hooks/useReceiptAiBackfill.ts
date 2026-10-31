/**
 * Helpers for document AI loading state.
 *
 * Auto backfill on booking-detail open was removed — AI document checks run only
 * when an admin triggers **AI Summary** (`booking-ai-review`), to avoid burning tokens.
 * `validate-booking-receipts` remains available as an admin edge endpoint if needed.
 */

import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

function documentUrlNeedsAiBackfill(
  url: string | null | undefined,
  verdict: string | null | undefined
): boolean {
  return Boolean(url?.trim()) && !String(verdict ?? '').trim();
}

/** True while a caller is still waiting on a verdict for a stored file. */
export function receiptAiPreviewLoading(
  isBackfilling: boolean,
  url: string | null | undefined,
  verdict: string | null | undefined
): boolean {
  return isBackfilling && documentUrlNeedsAiBackfill(url, verdict);
}

/**
 * @deprecated No-op. Page-view AI backfill was removed; keep the export so call sites
 * that still pass `isBackfilling` compile until props are cleaned up.
 */
export function useReceiptAiBackfill(_booking: BookingRow | null | undefined) {
  return { isBackfilling: false as const };
}
