import { countParkingNights } from '@/features/guest/pay-parking/lib/payParkingHelpers';

import { formatStayDateRange, toGuestSubmissionDate } from '@/utils/format/dates';

/** ISO or booking date strings → readable range, e.g. `Sep 24-28, 2026`. */
export function formatParkingStayRange(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined
): string | null {
  return formatStayDateRange(checkIn, checkOut);
}

export function countParkingStayNights(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined
): number | null {
  if (!checkIn?.trim() || !checkOut?.trim()) return null;
  try {
    return countParkingNights(toGuestSubmissionDate(checkIn), toGuestSubmissionDate(checkOut));
  } catch {
    return null;
  }
}

/**
 * Host/guest broadcast TTL display.
 * Under 1h → `MM:SS`; 1h+ → `Xh YYm`; 24h+ → `Xd Yh`.
 */
export function formatParkingBroadcastCountdown(remainingMs: number): string {
  const clamped = Math.max(0, remainingMs);
  const totalSeconds = Math.floor(clamped / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Screen-reader friendly rounded countdown (minute boundaries). */
export function parkingBroadcastCountdownA11yLabel(remainingMs: number): string {
  const clamped = Math.max(0, remainingMs);
  const roundedMinutes = Math.ceil(clamped / 60_000);
  if (roundedMinutes <= 1) return 'Less than a minute remaining';
  if (roundedMinutes < 60) return `${roundedMinutes} minutes remaining`;
  const hours = Math.ceil(roundedMinutes / 60);
  if (hours < 24) return `${hours} hours remaining`;
  const days = Math.ceil(hours / 24);
  return `${days} days remaining`;
}
