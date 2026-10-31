import { format, isSameMonth, isSameYear, parse, startOfDay } from 'date-fns';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

// Set timezone to Asia/Manila
dayjs.tz.setDefault('Asia/Manila');

/** User-facing date in pickers and ISO date inputs (slashes). */
export const DATE_PICKER_DISPLAY_FORMAT = 'MM/DD/YYYY';

/** date-fns pattern matching {@link DATE_PICKER_DISPLAY_FORMAT}. */
export const DATE_FNS_PICKER_DISPLAY_FORMAT = 'MM/dd/yyyy';

// Format date to YYYY-MM-DD
export const formatDateToYYYYMMDD = (date: Date) => dayjs(date).format('YYYY-MM-DD');

/** ISO `YYYY-MM-DD` → `MM/DD/YYYY` for date picker display. */
export function formatIsoDateForDisplay(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = dayjs(iso.slice(0, 10), 'YYYY-MM-DD', true);
  if (!d.isValid()) return '';
  return d.format(DATE_PICKER_DISPLAY_FORMAT);
}

export const formatDateToMMDDYYYY = (dateString: string): string => {
  try {
    if (!dateString) return '';
    const date = dayjs(dateString);
    if (!date.isValid()) return '';

    return date.format('MM-DD-YYYY');
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

export const formatDateToLongFormat = (dateString: string): string => {
  try {
    if (!dateString) return '';
    const date = dayjs(dateString);
    if (!date.isValid()) return '';

    return date.format('MMM D, YYYY');
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

/** ISO `YYYY-MM-DD` → `January 1, 2026` for user-facing contract dates. */
export function formatYmdToFullLongDate(ymd: string | null | undefined): string {
  if (!ymd) return '';
  const date = dayjs(ymd.slice(0, 10), 'YYYY-MM-DD', true);
  if (!date.isValid()) return '';
  return date.format('MMMM D, YYYY');
}

/** Timestamp → `MMM D, YYYY` in Asia/Manila, for record lines like "Completed". */
export const formatManilaLongDate = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = dayjs(iso);
  if (!d.isValid()) return '';
  return d.tz('Asia/Manila').format('MMM D, YYYY');
};

/** User-facing 12-hour time (e.g. `2:00 PM`). Accepts DB `HH:mm` or legacy `h:mm A`. */
export const formatTimeToAMPM = (time: string, isCheckIn: boolean = false): string => {
  const fallback = isCheckIn ? '2:00 PM' : '11:00 AM';
  try {
    const s = (time ?? '').trim();
    if (!s) return fallback;

    const hm24 = toGuestSubmissionTime(s);
    if (/^\d{2}:\d{2}$/.test(hm24)) {
      const parsed = dayjs(`2000-01-01T${hm24}`);
      if (parsed.isValid()) return parsed.format('h:mm A');
    }

    const loose = dayjs(`2000-01-01 ${s}`);
    return loose.isValid() ? loose.format('h:mm A') : fallback;
  } catch (error) {
    console.error('Error formatting time:', error);
    return fallback;
  }
};

// Get today and tomorrow dates
export const getDefaultDates = () => {
  const today = dayjs();
  const tomorrow = today.add(1, 'day');

  return {
    today: today.toDate(),
    tomorrow: tomorrow.toDate(),
  };
};

/** Today in Asia/Manila as YYYY-MM-DD (for Manila-aligned date inputs). */
export const getManilaYmdToday = () => dayjs().tz('Asia/Manila').format('YYYY-MM-DD');

/** Next calendar day in Asia/Manila (YYYY-MM-DD). */
export const getManilaYmdTomorrow = () =>
  dayjs().tz('Asia/Manila').add(1, 'day').format('YYYY-MM-DD');

export const getNextDay = (date: string) => {
  return dayjs(date).add(1, 'day').format('YYYY-MM-DD');
};

// Type for booked date range
export interface BookedDateRange {
  id: string;
  checkInDate: string;
  checkOutDate: string;
  /** 24h `HH:mm`, present for real bookings (absent for owner-managed blocked ranges). */
  checkInTime?: string;
  checkOutTime?: string;
}

/** Minutes from `prevTime` to `nextTime` (both 24h `HH:mm`); negative if `nextTime` is earlier. */
export function minutesBetweenTimeStrings(prevTime: string, nextTime: string): number {
  const [ah, am] = prevTime.split(':').map(Number);
  const [bh, bm] = nextTime.split(':').map(Number);
  if ([ah, am, bh, bm].some((n) => Number.isNaN(n))) return 0;
  return bh * 60 + bm - (ah * 60 + am);
}

/** `HH:mm` shifted by `minutes` (may be negative), wrapping within a single day. */
export function addMinutesToTimeString(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// Normalize any date string to YYYY-MM-DD format
export const normalizeDateString = (dateString: string): string => {
  if (!dateString) return '';

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }

  // Handle M-DD-YYYY or MM-DD-YYYY format (e.g., "1-15-2026" or "01-15-2026")
  const mdyMatch = dateString.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (mdyMatch) {
    const [, month, day, year] = mdyMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Fallback: try to parse with dayjs and format
  const parsed = dayjs(dateString);
  if (parsed.isValid()) {
    return parsed.format('YYYY-MM-DD');
  }

  return dateString;
};

// Convert date string (any format) to Date object
export const stringToDate = (dateString: string): Date => {
  const normalized = normalizeDateString(dateString);
  return parse(normalized, 'yyyy-MM-dd', new Date());
};

/** Readable range from two `Date`s, e.g. `Aug 11 - 18, 2026`. */
export function formatDateRangeFromDates(from: Date, to: Date): string {
  if (isSameYear(from, to)) {
    if (isSameMonth(from, to)) {
      // e.g. Sep 24-28, 2026
      return `${format(from, 'MMM d')}-${format(to, 'd, yyyy')}`;
    }
    // e.g. Sep 28-Oct 2, 2026
    return `${format(from, 'MMM d')}-${format(to, 'MMM d, yyyy')}`;
  }
  return `${format(from, 'MMM d, yyyy')}-${format(to, 'MMM d, yyyy')}`;
}

function parseStayBoundaryDate(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const normalized = normalizeDateString(trimmed);
    if (!normalized) return null;
    const date = stringToDate(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/** ISO `YYYY-MM-DD` or booking `MM-DD-YYYY` → single readable date, e.g. `Aug 11, 2026`. */
export function formatStayBoundaryDate(raw: string | null | undefined): string {
  const date = raw ? parseStayBoundaryDate(raw) : null;
  return date ? format(date, 'MMM d, yyyy') : '';
}

/** Compact variant for tight layouts (e.g. boarding-pass cards), e.g. `Aug 11`. */
export function formatStayBoundaryDateShort(raw: string | null | undefined): string {
  const date = raw ? parseStayBoundaryDate(raw) : null;
  return date ? format(date, 'MMM d') : '';
}

/**
 * ISO `YYYY-MM-DD` or booking `MM-DD-YYYY` → readable stay range, e.g. `Sep 24-28, 2026`.
 */
export function formatStayDateRange(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined
): string | null {
  const from = checkIn ? parseStayBoundaryDate(checkIn) : null;
  if (!from) return null;

  if (!checkOut?.trim()) {
    return format(from, 'MMM d, yyyy');
  }

  const to = parseStayBoundaryDate(checkOut);
  if (!to) return format(from, 'MMM d, yyyy');

  return formatDateRangeFromDates(from, to);
}

// Convert Date object to YYYY-MM-DD string
export const dateToString = (date: Date): string => {
  return dayjs(date).format('YYYY-MM-DD');
};

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Parse `checkInDate` / `checkOutDate` query params for guest inquiry flows. */
export function parseGuestInquiryDateRange(
  checkInRaw: string | null | undefined,
  checkOutRaw: string | null | undefined
): { checkIn: Date; checkOut: Date } | null {
  const checkInText = checkInRaw?.trim() ?? '';
  const checkOutText = checkOutRaw?.trim() ?? '';
  if (!ISO_DATE_ONLY.test(checkInText) || !ISO_DATE_ONLY.test(checkOutText)) return null;

  const checkIn = new Date(`${checkInText}T00:00:00`);
  const checkOut = new Date(`${checkOutText}T00:00:00`);
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) return null;
  if (checkOut <= checkIn) return null;

  return { checkIn, checkOut };
}

/** `guest_submissions.valid_dates` — stored as MM-DD-YYYY text. */
export function toGuestSubmissionDate(text: string): string {
  const s = (text ?? '').trim();
  if (!s) return s;
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return dayjs(s, 'YYYY-MM-DD', true).format('MM-DD-YYYY');
  }
  const normalized = normalizeDateString(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return dayjs(normalized, 'YYYY-MM-DD', true).format('MM-DD-YYYY');
  }
  return s;
}

/** Normalize to 24-hour HH:mm for guest_submissions. */
export function toGuestSubmissionTime(text: string): string {
  const s = (text ?? '').trim();
  if (!s) return s;
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 5);
  const ampm = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)$/i);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = ampm[2];
    const mer = ampm[3].toUpperCase();
    if (mer === 'AM' && h === 12) h = 0;
    else if (mer === 'PM' && h !== 12) h += 12;
    return `${String(h).padStart(2, '0')}:${m}`;
  }
  const short = s.match(/^(\d{1,2}):(\d{2})$/);
  if (short) return `${short[1].padStart(2, '0')}:${short[2]}`;
  return s;
}

// Create a disabled date matcher for react-day-picker (for check-in dates)
export const createDisabledDateMatcher = (
  bookedDates: BookedDateRange[],
  currentBookingId?: string | null
) => {
  return (date: Date) => {
    // Check if this date falls within any booked range
    return bookedDates.some((booking) => {
      // Skip checking against the current booking if we're editing
      if (currentBookingId && booking.id === currentBookingId) {
        return false;
      }

      try {
        const checkIn = stringToDate(booking.checkInDate);
        const checkOut = stringToDate(booking.checkOutDate);
        const dateToCheck = startOfDay(date);

        // Check if date is within the booked range (check-in inclusive, check-out exclusive)
        // This allows guests to check in on checkout dates
        return dateToCheck >= startOfDay(checkIn) && dateToCheck < startOfDay(checkOut);
      } catch (e) {
        return false;
      }
    });
  };
};

// Create a disabled date matcher for checkout dates
// This allows selecting checkout dates that are check-in dates of other bookings
export const createDisabledCheckoutDateMatcher = (
  bookedDates: BookedDateRange[],
  currentBookingId?: string | null
) => {
  return (date: Date) => {
    // Check if this date falls within any booked range
    return bookedDates.some((booking) => {
      // Skip checking against the current booking if we're editing
      if (currentBookingId && booking.id === currentBookingId) {
        return false;
      }

      try {
        const checkIn = stringToDate(booking.checkInDate);
        const checkOut = stringToDate(booking.checkOutDate);
        const dateToCheck = startOfDay(date);

        // For checkout dates: Only disable dates that are AFTER check-in and BEFORE check-out
        // This allows selecting a checkout date that matches another booking's check-in date
        // (Guest A checks out on Dec 15, Guest B checks in on Dec 15)
        return dateToCheck > startOfDay(checkIn) && dateToCheck < startOfDay(checkOut);
      } catch (e) {
        return false;
      }
    });
  };
};
