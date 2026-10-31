/**
 * Turn a raw `booking_source` slug into a label a host recognises.
 * Known channels get a canonical name; anything else is de-slugified
 * (`marketing_review_seed` -> `Marketing Review Seed`) so the legend never
 * shows a database value.
 *
 * Mirror: `supabase/functions/_shared/analyticsChannel.ts`
 * Keep both in lockstep — Direct / website aliases must roll up together.
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

/** Canonical channel key used for mix aggregation + display. */
export function prettyChannelLabel(raw: string | null | undefined): string {
  const key = (raw ?? '').trim().toLowerCase();
  if (key in KNOWN_CHANNEL_LABELS) return KNOWN_CHANNEL_LABELS[key];
  return key
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
