/**
 * Confirmation gate for `PENDING_REVIEW`: the workflow rail keeps its stage
 * content and transition actions closed until the host confirms they read the
 * guest submission.
 *
 * The ack lives in sessionStorage, keyed by booking id and stamped with
 * `status_updated_at` (fallback `created_at`), so a server-side change that
 * returns the booking to `PENDING_REVIEW` asks for a fresh confirmation instead
 * of riding on the earlier one.
 */

import { useCallback, useEffect, useState } from 'react';

import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

const STORAGE_PREFIX = 'admin.pendingReviewWorkflowGate:v1:';

function gateStamp(booking: BookingRow): string {
  return (booking.status_updated_at ?? booking.created_at ?? '').trim();
}

function readStoredStamp(bookingId: string): string | null {
  try {
    return sessionStorage.getItem(STORAGE_PREFIX + bookingId);
  } catch {
    return null;
  }
}

function writeStoredStamp(bookingId: string, stamp: string) {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + bookingId, stamp);
  } catch {
    // Private mode / quota — the ack still holds for the rest of this mount.
  }
}

export type PendingReviewAck = {
  /** Stage content and transition actions stay closed while true. */
  needsReviewAck: boolean;
  confirmReview: () => void;
};

export function usePendingReviewAck(booking: BookingRow): PendingReviewAck {
  const stamp = gateStamp(booking);
  const isPendingReview = booking.status === 'PENDING_REVIEW';

  const [ackedStamp, setAckedStamp] = useState<string | null>(() =>
    isPendingReview ? readStoredStamp(booking.id) : null
  );

  useEffect(() => {
    if (booking.status !== 'PENDING_REVIEW') return;
    setAckedStamp(readStoredStamp(booking.id));
  }, [booking.id, booking.status, stamp]);

  const confirmReview = useCallback(() => {
    writeStoredStamp(booking.id, stamp);
    setAckedStamp(stamp);
  }, [booking.id, stamp]);

  return { needsReviewAck: isPendingReview && ackedStamp !== stamp, confirmReview };
}
