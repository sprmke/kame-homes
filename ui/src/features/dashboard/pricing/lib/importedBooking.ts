import type { PropertyPricingCalendarBooking } from '@/features/dashboard/pricing/lib/propertyPricingApi';

/** True when the booking carries OTA provenance, whatever its workflow status. */
export function isImportedBooking(
  booking: PropertyPricingCalendarBooking | null | undefined
): boolean {
  if (!booking) return false;
  return (
    !!booking.external_source || (booking.booking_source ?? '').trim().toLowerCase() === 'airbnb'
  );
}

/**
 * An OTA reservation still awaiting review. Only these can mint the guest-form
 * completion link (mirrors `checkCompletionEligibility` on the edge).
 */
export function isImportedPendingBooking(
  booking: PropertyPricingCalendarBooking | null | undefined
): boolean {
  return isImportedBooking(booking) && booking?.status === 'PENDING_REVIEW';
}

function parseStoredDate(value: string | null | undefined): Date | null {
  const raw = String(value ?? '').trim();
  const mdy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw);
  if (mdy) return new Date(Number(mdy[3]), Number(mdy[1]) - 1, Number(mdy[2]));
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  return null;
}

/** The edge 410s once checkout has passed, so hide the action before the click. */
export function isCompletionLinkLive(
  booking: PropertyPricingCalendarBooking | null | undefined,
  today: Date = new Date()
): boolean {
  if (!booking) return false;
  const checkOut = parseStoredDate(booking.check_out_date);
  if (!checkOut) return false;
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  return checkOut >= start;
}
