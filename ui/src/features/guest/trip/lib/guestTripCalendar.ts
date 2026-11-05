/**
 * "Add to calendar" for a trip: a single all-stay VEVENT (.ics) from check-in to check-out.
 * Times are Asia/Manila wall-clock (UTC+8, no DST) converted to UTC.
 */

const MANILA_OFFSET_HOURS = 8;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** `YYYY-MM-DD` + `HH:mm` (Manila) → `YYYYMMDDTHHMMSSZ`. Falls back to `fallbackTime`. */
export function manilaToIcsUtc(ymd: string, time: string | null, fallbackTime: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const match =
    /^(\d{1,2}):(\d{2})/.exec((time ?? '').trim()) ?? /^(\d{1,2}):(\d{2})/.exec(fallbackTime);
  const hh = Number(match?.[1] ?? 0);
  const mm = Number(match?.[2] ?? 0);
  const utc = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, hh - MANILA_OFFSET_HOURS, mm));
  return (
    `${utc.getUTCFullYear()}${pad(utc.getUTCMonth() + 1)}${pad(utc.getUTCDate())}` +
    `T${pad(utc.getUTCHours())}${pad(utc.getUTCMinutes())}00Z`
  );
}

/** RFC 5545 TEXT escaping. */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function buildGuestTripIcs(input: {
  bookingId: string;
  propertyName: string;
  checkInDate: string;
  checkOutDate: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  address?: string | null;
  /** Trip page URL without the access key. */
  tripUrl?: string | null;
  now?: Date;
}): string {
  const stamp = (input.now ?? new Date())
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kame Space//Guest Trip//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:trip-${input.bookingId}@kamehomes`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${manilaToIcsUtc(input.checkInDate, input.checkInTime, '14:00')}`,
    `DTEND:${manilaToIcsUtc(input.checkOutDate, input.checkOutTime, '11:00')}`,
    `SUMMARY:${escapeIcsText(`Stay at ${input.propertyName}`)}`,
  ];
  if (input.address?.trim()) lines.push(`LOCATION:${escapeIcsText(input.address.trim())}`);
  if (input.tripUrl?.trim()) {
    lines.push(`DESCRIPTION:${escapeIcsText(`Trip details: ${input.tripUrl.trim()}`)}`);
    lines.push(`URL:${input.tripUrl.trim()}`);
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

export function downloadGuestTripIcs(filename: string, ics: string): void {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
