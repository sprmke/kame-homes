import { guestCalendarPath } from '@/features/guest/lib/guestPublicPaths';

import { formatTimeToAMPM } from '@/utils/format/dates';

export type CheckInPackInput = {
  propertySlug: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  mapsUrl?: string | null;
  stayGuideUrl?: string | null;
};

/** Multi-line check-in bundle for host chat insert (plain text + https links → rich cards). */
export function buildCheckInPackContent(input: CheckInPackInput): string | null {
  const slug = input.propertySlug.trim();
  if (!slug) return null;

  const checkInTime = (input.checkInTime?.trim() || '14:00').slice(0, 5);
  const checkOutTime = (input.checkOutTime?.trim() || '12:00').slice(0, 5);
  const mapsUrl = input.mapsUrl?.trim() ?? '';
  const stayGuideUrl = input.stayGuideUrl?.trim() ?? '';

  const lines: string[] = [
    'Check-in details',
    `Check-in: ${formatTimeToAMPM(checkInTime, true)} · Check-out: ${formatTimeToAMPM(checkOutTime, false)}`,
  ];

  if (stayGuideUrl) lines.push(stayGuideUrl);
  if (mapsUrl) lines.push(mapsUrl);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  if (origin) {
    lines.push(`${origin}${guestCalendarPath(slug)}`);
  }

  return lines.join('\n');
}

export function readPropertyCheckInTimes(settings: Record<string, unknown> | null | undefined): {
  checkInTime: string;
  checkOutTime: string;
} {
  const checkIn =
    typeof settings?.checkInTime === 'string' && settings.checkInTime.trim()
      ? settings.checkInTime.trim()
      : '14:00';
  const checkOut =
    typeof settings?.checkOutTime === 'string' && settings.checkOutTime.trim()
      ? settings.checkOutTime.trim()
      : '12:00';
  return { checkInTime: checkIn, checkOutTime: checkOut };
}
