/**
 * Turns document mentions inside AI review text ("Guest 1: ID marked invalid.",
 * "no pet photo or vaccination record") into references to the booking's stored files,
 * so the AI Summary modal can open the shared asset preview from the sentence itself.
 *
 * Only files that actually exist on the booking become references — a mention of a
 * document the booking never uploaded stays plain text.
 */

import { ADMIN_GUEST_VIEW_SLOTS } from '@/features/dashboard/bookings/lib/adminGuestSlots';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

export type BookingAiDocumentRef = {
  id: string;
  /** Title shown in the preview modal — matches the Files tab wording. */
  label: string;
  url: string;
  /** Regex sources matched against AI text, most specific first. */
  patterns: string[];
};

export type BookingAiTextSegment = {
  text: string;
  ref?: BookingAiDocumentRef;
};

/** `Guest 2: ID`, `Guest 2 valid ID`, `Guest 2's ID`, `G2`. */
function guestIdPatterns(index: number): string[] {
  return [
    `Guest\\s*${index}(?:'s)?\\s*[:\\-–]?\\s*(?:valid\\s+)?IDs?`,
    `G${index}(?:'s)?\\s*(?:valid\\s+)?IDs?`,
    `G${index}`,
  ];
}

export function collectBookingAiDocumentRefs(booking: BookingRow): BookingAiDocumentRef[] {
  const refs: BookingAiDocumentRef[] = [];

  const push = (id: string, label: string, url: string | null | undefined, patterns: string[]) => {
    const trimmed = url?.trim();
    if (!trimmed) return;
    refs.push({ id, label, url: trimmed, patterns });
  };

  const idSlots = ADMIN_GUEST_VIEW_SLOTS.filter((slot) => booking[slot.validIdUrlKey]?.trim());

  for (const slot of idSlots) {
    const patterns = guestIdPatterns(slot.index);
    // "valid ID" unqualified is only unambiguous when this is the booking's only ID.
    if (slot.index === 1) {
      patterns.push(`primary\\s+guest(?:'s)?\\s*(?:valid\\s+)?IDs?`);
      if (idSlots.length === 1) patterns.push(`valid\\s+IDs?`);
    }
    push(
      `guest${slot.index}_valid_id`,
      slot.index === 1 ? 'Valid ID' : `${slot.label} valid ID`,
      booking[slot.validIdUrlKey],
      patterns
    );
  }

  push('pet_image', 'Pet photo', booking.pet_image_url, ['pet\\s+(?:photo|image|picture)s?']);
  push('pet_vaccination', 'Vaccination record', booking.pet_vaccination_url, [
    'vaccination\\s+(?:record|card|document|certificate)s?',
    'vaccination',
  ]);

  push('parking_receipt', 'Parking payment receipt', booking.parking_payment_receipt_url, [
    'parking\\s+(?:payment\\s+)?receipts?',
  ]);
  push('balance_receipt', 'Payment balance receipt', booking.guest_balance_payment_receipt_url, [
    '(?:payment\\s+)?balance\\s+(?:payment\\s+)?receipts?',
  ]);
  push('sd_refund_receipt', 'SD refund receipt', booking.sd_refund_receipt_url, [
    '(?:SD|security\\s+deposit)\\s+refund\\s+receipts?',
  ]);
  push('dp_receipt', 'Downpayment receipt', booking.payment_receipt_url, [
    '(?:downpayment|down\\s+payment|DP)\\s+receipts?',
    'payment\\s+receipts?',
  ]);

  push('parking_endorsement', 'Parking endorsement', booking.parking_endorsement_url, [
    'parking\\s+endorsements?',
  ]);
  push('approved_gaf', 'Approved GAF', booking.approved_gaf_pdf_url, [
    'approved\\s+GAF',
    'GAF(?:\\s+form)?',
  ]);
  push('approved_pet_form', 'Approved pet form', booking.approved_pet_pdf_url, [
    'approved\\s+pet\\s+form',
  ]);

  return refs;
}

/**
 * Which files each review section may link. Without this, a pets finding
 * ("images show payment receipts, not pet photo") would link the downpayment receipt.
 */
const SECTION_DOCUMENT_IDS: Record<string, string[]> = {
  stay_details: [],
  guests: [
    'guest1_valid_id',
    'guest2_valid_id',
    'guest3_valid_id',
    'guest4_valid_id',
    'guest5_valid_id',
  ],
  parking: ['parking_receipt', 'parking_endorsement', 'dp_receipt'],
  pets: ['pet_image', 'pet_vaccination', 'approved_pet_form'],
  pricing: ['dp_receipt', 'balance_receipt', 'parking_receipt', 'sd_refund_receipt'],
};

/** Refs a given section's text is allowed to link — unknown sections link everything. */
export function bookingAiSectionDocumentRefs(
  sectionId: string,
  refs: BookingAiDocumentRef[]
): BookingAiDocumentRef[] {
  const allowed = SECTION_DOCUMENT_IDS[sectionId];
  if (!allowed) return refs;
  return refs.filter((ref) => allowed.includes(ref.id));
}

/**
 * One regex over every alias. Alternation order decides ties, so specific patterns
 * (`Guest 2: ID`) must precede generic ones (`valid ID`) — `collectBookingAiDocumentRefs`
 * already emits them in that order.
 */
function buildMatcher(refs: BookingAiDocumentRef[]): {
  regex: RegExp;
  byPattern: BookingAiDocumentRef[];
} | null {
  const groups: string[] = [];
  const byPattern: BookingAiDocumentRef[] = [];
  for (const ref of refs) {
    for (const pattern of ref.patterns) {
      groups.push(`(${pattern})`);
      byPattern.push(ref);
    }
  }
  if (groups.length === 0) return null;
  return { regex: new RegExp(`\\b(?:${groups.join('|')})`, 'gi'), byPattern };
}

/** Splits AI text into plain runs and document references, preserving original wording. */
export function linkifyBookingAiText(
  text: string,
  refs: BookingAiDocumentRef[]
): BookingAiTextSegment[] {
  if (!text) return [];
  const matcher = buildMatcher(refs);
  if (!matcher) return [{ text }];

  const segments: BookingAiTextSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(matcher.regex)) {
    const start = match.index ?? 0;
    // Group 1..n mirror `byPattern`; the first defined one is the alias that matched.
    const groupIndex = match.slice(1).findIndex((group) => group !== undefined);
    const ref = groupIndex >= 0 ? matcher.byPattern[groupIndex] : undefined;
    if (!ref) continue;
    if (start > cursor) segments.push({ text: text.slice(cursor, start) });
    segments.push({ text: match[0], ref });
    cursor = start + match[0].length;
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}
