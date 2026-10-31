import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import relativeTime from 'dayjs/plugin/relativeTime';

import { formatTimeToAMPM } from '@/utils/format/dates';

dayjs.extend(customParseFormat);
dayjs.extend(relativeTime);

/** `guest_submissions.check_*_date` stored as MM-DD-YYYY → `Apr 20, 2026`. */
export function formatBookingDate(mmddyyyy: string | null | undefined): string {
  if (!mmddyyyy) return '-';
  const d = dayjs(mmddyyyy, 'MM-DD-YYYY');
  if (!d.isValid()) return mmddyyyy;
  return d.format('MMM D, YYYY');
}

/** ISO YYYY-MM-DD → `Apr 20, 2026`. */
export function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = dayjs(iso.slice(0, 10));
  if (!d.isValid()) return iso;
  return d.format('MMM D, YYYY');
}

export function formatBookingDateShort(mmddyyyy: string | null | undefined): string {
  if (!mmddyyyy) return '-';
  const d = dayjs(mmddyyyy, 'MM-DD-YYYY');
  if (!d.isValid()) return mmddyyyy;
  return d.format('MMM D');
}

function formatBookingTime(time: string | null | undefined, isCheckIn = false): string {
  if (!time?.trim()) return '';
  return formatTimeToAMPM(time, isCheckIn);
}

export function formatBookingDateTime(
  date: string | null | undefined,
  time: string | null | undefined,
  isCheckIn = false
): string {
  const datePart = formatBookingDate(date);
  const timePart = formatBookingTime(time, isCheckIn);
  if (!timePart) return datePart;
  return `${datePart} at ${timePart}`;
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = dayjs(iso);
  if (!d.isValid()) return '-';
  return d.fromNow();
}
