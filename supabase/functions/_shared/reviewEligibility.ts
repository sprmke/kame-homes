/**
 * Two-way review eligibility. Generalizes `guestReviewEligibility.ts` (kept as
 * thin legacy wrappers for the SD-refund-specific callers) to every booking
 * that has reached check-out, regardless of source — guests review the stay,
 * hosts review the guest, both gated by the same 14-day window (D1).
 *
 * D3: the next-stay voucher is decoupled from the review — claimable once the
 * booking reaches check-out, independent of review submission (FTC Consumer
 * Reviews Rule, 16 CFR 465 — incentives must never be conditioned on a review
 * or its content).
 */

import { checkoutOnOrBeforeTodayManila } from './guestReviewEligibility.ts';
import { isWindowOpen, type ReviewWindowRow } from './reviewWindow.ts';

/** Statuses that only exist after the guest has checked out. */
const POST_CHECKOUT_STATUSES = new Set(['READY_FOR_CHECKOUT', 'PENDING_SD_REFUND', 'COMPLETED']);

/** True once a booking has reached check-out, however it got there. */
export function bookingReachedCheckout(row: Record<string, unknown>): boolean {
  const status = String(row.status ?? '');
  if (POST_CHECKOUT_STATUSES.has(status)) return true;
  if (status === 'READY_FOR_CHECKIN') {
    return checkoutOnOrBeforeTodayManila(row.check_out_date as string);
  }
  return false;
}

/** Guest can write/edit their review of the stay: reached check-out + window still open. */
export function guestCanReview(
  row: Record<string, unknown>,
  window: Pick<ReviewWindowRow, 'closes_at' | 'published_at'> | null
): boolean {
  if (!bookingReachedCheckout(row)) return false;
  if (!window) return true; // window not created yet — caller creates it on first write.
  return isWindowOpen(window);
}

/** Host can write/edit a review of the guest — same gate, source-agnostic (Airbnb included). */
export function hostCanReview(
  row: Record<string, unknown>,
  window: Pick<ReviewWindowRow, 'closes_at' | 'published_at'> | null
): boolean {
  return guestCanReview(row, window);
}

/** D3: voucher is claimable once the stay is over, regardless of review state. */
export function canClaimStayVoucher(row: Record<string, unknown>): boolean {
  return bookingReachedCheckout(row);
}

/** Orchestrator side effect: RFCI → RFCO opens the 14-day review window. */
export function checkoutTransitionOpensReviewWindow(fromStatus: string, toStatus: string): boolean {
  return fromStatus === 'READY_FOR_CHECKIN' && toStatus === 'READY_FOR_CHECKOUT';
}
