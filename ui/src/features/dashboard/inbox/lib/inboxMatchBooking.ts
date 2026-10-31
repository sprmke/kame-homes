import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import type { InboxConversation } from '@/features/dashboard/inbox/types/inbox';

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** ISO YYYY-MM-DD (inquiry) → booking MM-DD-YYYY. */
function inquiryDateToBookingDate(isoDate: string): string {
  const [y, m, d] = isoDate.trim().split('-');
  if (!y || !m || !d) return '';
  return `${m}-${d}-${y}`;
}

/**
 * Strict guest-name match for auto-selecting a booking.
 * Exact match, or all tokens of the shorter name appear as whole tokens in the longer
 * (avoids "Maria" ↔ "Mariana" / short substring false positives).
 */
export function bookingNamesMatch(participantRaw: string, booking: BookingRow): boolean {
  const participant = normalizeName(participantRaw);
  if (!participant) return false;

  const candidates = [booking.primary_guest_name, booking.guest_facebook_name]
    .filter(Boolean)
    .map((name) => normalizeName(String(name)));

  return candidates.some((name) => {
    if (!name) return false;
    if (name === participant) return true;

    const a = participant.split(' ').filter(Boolean);
    const b = name.split(' ').filter(Boolean);
    if (a.length === 0 || b.length === 0) return false;

    const shorter = a.length <= b.length ? a : b;
    const longer = a.length <= b.length ? b : a;
    const longerSet = new Set(longer);

    // Multi-token shorter name: every token must appear in the longer name.
    if (shorter.length >= 2) {
      return shorter.every((token) => longerSet.has(token));
    }

    // Single token: only match as a whole token of the other name (min length 3).
    const token = shorter[0]!;
    if (token.length < 3) return false;
    return longerSet.has(token);
  });
}

/** Best-effort booking match for the open inbox thread (inquiry dates + guest name). */
export function matchBookingForConversation(
  conversation: InboxConversation | null | undefined,
  bookings: BookingRow[]
): BookingRow | null {
  if (!conversation || bookings.length === 0) return null;

  const participant = normalizeName(conversation.participant_name ?? '');
  const inquiryIn = conversation.inquiry_check_in?.trim();
  const inquiryOut = conversation.inquiry_check_out?.trim();

  let candidates = bookings;

  if (inquiryIn && inquiryOut) {
    const inBooking = inquiryDateToBookingDate(inquiryIn);
    const outBooking = inquiryDateToBookingDate(inquiryOut);
    if (inBooking && outBooking) {
      const byDates = candidates.filter(
        (row) => row.check_in_date === inBooking && row.check_out_date === outBooking
      );
      if (byDates.length === 1) return byDates[0]!;
      if (byDates.length > 0) candidates = byDates;
    }
  }

  if (participant) {
    const byName = candidates.filter((row) => bookingNamesMatch(participant, row));
    if (byName.length === 1) return byName[0]!;
    if (byName.length > 0) candidates = byName;
  }

  // Only auto-select when still uniquely determined after filters.
  // Do not fall back to "first of many" — that risks wrong Stay Guide / docs.
  return candidates.length === 1 ? (candidates[0] ?? null) : null;
}
