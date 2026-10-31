/**
 * Minimal, tiered grounding for the guest voice receptionist.
 * This intentionally does not reuse the broad inbox auto-reply context.
 */

import { serializeGuestPaymentInfo } from './appSettings.ts';
import { manilaTodayYmd } from './calendarAvailabilityManila.ts';
import { loadGuestSafePropertyContext } from './inboxAiGuestContext.ts';
import { createServiceClient } from './orgAuth.ts';

export type GuestReceptionistContextTier =
  'public' | 'inquiry' | 'verified_booking' | 'verified_stay';

export type GuestReceptionistContext = {
  tier: GuestReceptionistContextTier;
  factsText: string;
  bookingId: string | null;
};

const SAFE_BOOKING_STATUSES = [
  'PENDING_REVIEW',
  'PENDING_DOCUMENTS',
  'READY_FOR_CHECKIN',
  'READY_FOR_CHECKOUT',
  'PENDING_SD_REFUND',
  'COMPLETED',
];

export const NEVER_VOICE_FACTS = [
  'government IDs and document images',
  'payment account numbers and receipts',
  'internal notes and finance ledgers',
  'other guests and team data',
  'access credentials before a verified active stay',
] as const;

function normalizeYmd(value: string | null): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return match ? `${match[3]}-${match[1]}-${match[2]}` : null;
}

function shiftYmd(ymd: string, days: number): string {
  const date = new Date(`${ymd}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatUntrustedVoiceFacts(facts: string[]): string {
  return facts
    .map((fact) =>
      JSON.stringify(
        fact
          .replace(/[\u0000-\u001f\u007f]/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim()
          .slice(0, 500)
      )
    )
    .join('\n');
}

export async function buildGuestReceptionistContext(input: {
  propertyId: string;
  guestUserId: string;
  guestEmail: string;
  inquiryCheckIn?: string | null;
  inquiryCheckOut?: string | null;
}): Promise<GuestReceptionistContext> {
  const property = await loadGuestSafePropertyContext(input.propertyId);
  if (!property) throw new Error('Property not found');

  const paymentInfo = await serializeGuestPaymentInfo(input.propertyId);
  const paymentMethods = [
    ...new Set(
      paymentInfo.paymentMethods
        .map((method) => method.provider.trim())
        .filter(Boolean)
        .slice(0, 8)
    ),
  ];
  const publicFacts = [
    `Property: ${property.name}`,
    `Location: ${property.locationLabel}`,
    `Check-in: ${property.checkInTime}`,
    `Check-out: ${property.checkOutTime}`,
    `Maximum guests: ${property.maxGuests}`,
    property.amenities.length ? `Amenities: ${property.amenities.slice(0, 20).join(', ')}` : '',
    property.houseRules.length ? `House rules: ${property.houseRules.slice(0, 12).join('; ')}` : '',
    property.cancellationPolicyTitle
      ? `Cancellation: ${property.cancellationPolicyTitle}. ${property.cancellationPolicyDescription}`
      : '',
    paymentMethods.length ? `Payment methods: ${paymentMethods.join(', ')}` : '',
    property.mapsUrl ? `Map: ${property.mapsUrl}` : '',
    property.guestFormUrl ? `Booking form: ${property.guestFormUrl}` : '',
  ].filter(Boolean);

  const inquiryFacts = [
    input.inquiryCheckIn ? `Requested check-in: ${input.inquiryCheckIn}` : '',
    input.inquiryCheckOut ? `Requested check-out: ${input.inquiryCheckOut}` : '',
  ].filter(Boolean);

  const sb = createServiceClient();
  const normalizedEmail = input.guestEmail.trim().toLowerCase();
  const today = manilaTodayYmd();
  const earliestStay = shiftYmd(today, -90);
  const latestStay = shiftYmd(today, 365);
  const bookingSelect = 'id, status, check_in_date, check_out_date';
  const { data: ownedBooking, error: ownedError } = await sb
    .from('guest_submissions')
    .select(bookingSelect)
    .eq('property_id', input.propertyId)
    .in('status', SAFE_BOOKING_STATUSES)
    .eq('guest_user_id', input.guestUserId)
    .gte('check_out_date_sql', earliestStay)
    .lte('check_in_date_sql', latestStay)
    .order('check_in_date_sql', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ownedError) {
    console.warn('[guestReceptionistContext] booking ownership lookup failed:', ownedError.message);
  }

  let booking = ownedBooking;
  if (!booking && !ownedError && normalizedEmail) {
    const { data: legacyBooking, error: legacyError } = await sb
      .from('guest_submissions')
      .select(bookingSelect)
      .eq('property_id', input.propertyId)
      .in('status', SAFE_BOOKING_STATUSES)
      .is('guest_user_id', null)
      .eq('guest_email', normalizedEmail)
      .gte('check_out_date_sql', earliestStay)
      .lte('check_in_date_sql', latestStay)
      .order('check_in_date_sql', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (legacyError) {
      console.warn('[guestReceptionistContext] legacy booking lookup failed:', legacyError.message);
    }
    booking = legacyBooking;
  }

  if (!booking) {
    return {
      tier: inquiryFacts.length ? 'inquiry' : 'public',
      factsText: formatUntrustedVoiceFacts([...publicFacts, ...inquiryFacts]),
      bookingId: null,
    };
  }

  const checkIn = normalizeYmd(String(booking.check_in_date ?? ''));
  const checkOut = normalizeYmd(String(booking.check_out_date ?? ''));
  const activeStay = Boolean(checkIn && checkOut && checkIn <= today && checkOut >= today);
  const verifiedFacts = [
    `Your booking status: ${String(booking.status).replaceAll('_', ' ').toLowerCase()}`,
    checkIn ? `Your check-in: ${checkIn}` : '',
    checkOut ? `Your check-out: ${checkOut}` : '',
    activeStay
      ? 'Verified active stay. Stay-guide details may be requested through the stay-guide tool.'
      : 'Verified booking. Access credentials are not available before the active stay.',
  ].filter(Boolean);

  return {
    tier: activeStay ? 'verified_stay' : 'verified_booking',
    factsText: formatUntrustedVoiceFacts([...publicFacts, ...inquiryFacts, ...verifiedFacts]),
    bookingId: booking.id as string,
  };
}
