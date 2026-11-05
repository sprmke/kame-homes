/**
 * Calendar sync Phase 2 — pure matching rules for turning an OTA reservation into a
 * `guest_submissions` row without duplicating a booking the host already entered.
 *
 * Kept free of DB access so the adoption / relink / past-stay decisions are unit tested.
 */

import { normalizeBookingDateToYmd } from './calendarAvailabilityManila.ts';

export type IngestBookingRow = {
  id: string;
  status: string;
  check_in_date: string;
  check_out_date: string;
  booking_source: string | null;
  external_uid: string | null;
  external_feed_id: string | null;
};

/** Rows the sync must never treat as a live booking to adopt, relink, or cancel. */
export function isEligibleIngestRow(row: IngestBookingRow): boolean {
  return row.status !== 'CANCELLED' && row.status !== 'IMPORTED';
}

/** True for a source label we are allowed to adopt into an OTA feed (Airbnb today). */
export function isAirbnbBookingSource(source: string | null | undefined): boolean {
  return (
    String(source ?? '')
      .trim()
      .toLowerCase() === 'airbnb'
  );
}

/** `YYYY-MM-DD|YYYY-MM-DD` for exact-date matching; null when either date is unparseable. */
export function bookingDateKey(checkIn: string, checkOut: string): string | null {
  const start = normalizeBookingDateToYmd(checkIn);
  const end = normalizeBookingDateToYmd(checkOut);
  if (!start || !end) return null;
  return `${start}|${end}`;
}

/**
 * A stay whose checkout is already past should not create a new booking row. The
 * feed can still list older reservations, and importing them would fill the host's
 * Bookings list with `PENDING_REVIEW` ghosts after they enable ingestion.
 */
export function isPastReservation(endDateYmd: string, todayYmd: string): boolean {
  if (!endDateYmd || !todayYmd) return false;
  return endDateYmd < todayYmd;
}

/**
 * A row already carrying this UID but no longer attached to this feed (the feed was
 * removed and reconnected). Re-link it instead of inserting a duplicate.
 */
export function findRelinkableBooking(
  rows: IngestBookingRow[],
  uid: string,
  feedId: string
): IngestBookingRow | null {
  const target = String(uid ?? '').trim();
  if (!target) return null;
  return (
    rows.find(
      (row) =>
        isEligibleIngestRow(row) && row.external_uid === target && row.external_feed_id !== feedId
    ) ?? null
  );
}

/**
 * A manually entered Airbnb row with the exact same stay. Hosts who already re-key
 * Airbnb reservations should get provenance attached, not a second booking.
 */
export function findAdoptableManualBooking(
  rows: IngestBookingRow[],
  input: { checkInYmd: string; checkOutYmd: string; bookingSource: string }
): IngestBookingRow | null {
  const key = bookingDateKey(input.checkInYmd, input.checkOutYmd);
  if (!key) return null;
  return (
    rows.find(
      (row) =>
        isEligibleIngestRow(row) &&
        !row.external_uid &&
        isAirbnbBookingSource(row.booking_source) &&
        isAirbnbBookingSource(input.bookingSource) &&
        bookingDateKey(row.check_in_date, row.check_out_date) === key
    ) ?? null
  );
}
