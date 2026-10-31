import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

import type { BookingStatus } from '@/features/dashboard/bookings/lib/bookingStatus';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

const MANILA = 'Asia/Manila';

const PIPELINE_WARN_STATUSES = new Set<BookingStatus>([
  'PENDING_REVIEW',
  'PENDING_DOCUMENTS',
  'READY_FOR_CHECKIN',
]);

function parseBookingStayDate(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = dayjs.tz(v, 'YYYY-MM-DD', MANILA);
    return d.isValid() ? d.startOf('day') : null;
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(v)) {
    const d = dayjs.tz(v, 'MM-DD-YYYY', MANILA);
    return d.isValid() ? d.startOf('day') : null;
  }
  return null;
}

/**
 * True when the row is still in an early pipeline stage but the scheduled
 * check-in or check-out calendar date (Asia/Manila) is strictly before today.
 * Used to warn before each "Proceed to …" forward transition.
 */
export function shouldWarnPastBookingStayForProceed(
  status: BookingStatus,
  booking: BookingRow
): boolean {
  if (!PIPELINE_WARN_STATUSES.has(status)) return false;
  const checkIn = parseBookingStayDate(booking.check_in_date);
  const checkOut = parseBookingStayDate(booking.check_out_date);
  if (!checkIn || !checkOut) return false;
  const today = dayjs().tz(MANILA).startOf('day');
  return checkIn.isBefore(today) || checkOut.isBefore(today);
}
