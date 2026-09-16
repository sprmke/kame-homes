/**
 * Canonical booking-channel labels for analytics channel mix.
 * Mirror: `ui/src/features/dashboard/analytics/lib/channelLabels.ts`
 * Keep both in lockstep — Direct / website / empty aliases must roll up together.
 */

const KNOWN_CHANNEL_LABELS: Record<string, string> = {
  airbnb: 'Airbnb',
  booking: 'Booking.com',
  booking_com: 'Booking.com',
  'booking.com': 'Booking.com',
  bookingcom: 'Booking.com',
  agoda: 'Agoda',
  expedia: 'Expedia',
  vrbo: 'Vrbo',
  direct: 'Direct',
  website: 'Direct',
  facebook: 'Facebook',
  instagram: 'Instagram',
  messenger: 'Messenger',
  whatsapp: 'WhatsApp',
  referral: 'Referral',
  walkin: 'Walk-in',
  walk_in: 'Walk-in',
  tiktok: 'TikTok',
  unknown: 'Unknown',
  '': 'Unknown',
};

/** Roll up raw `booking_source` values into one host-facing channel label. */
export function canonicalAnalyticsChannel(raw: string | null | undefined): string {
  const key = (raw ?? '').trim().toLowerCase();
  if (key in KNOWN_CHANNEL_LABELS) return KNOWN_CHANNEL_LABELS[key];
  return key
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
