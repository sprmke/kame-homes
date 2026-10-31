/**
 * Shared booleans for booking list / card / calendar flag chips.
 */

import { flagIconChipClasses } from '@/lib/statusToneColors';

/** Guest requested surprise decor / room setup (DB may use bool or legacy string). */
export function bookingRequestsSurpriseDecor(value: unknown): boolean {
  return value === true || value === 'true';
}

type ReceiptAiFlagBooking = {
  payment_receipt_url?: string | null;
  dp_receipt_ai_verdict?: string | null;
  guest_balance_payment_receipt_url?: string | null;
  balance_receipt_ai_verdict?: string | null;
  parking_payment_receipt_url?: string | null;
  parking_receipt_ai_verdict?: string | null;
};

/** True when any on-file payment receipt has AI verdict `invalid` (list chip: "AI: Needs review"). */
export function bookingHasInvalidReceiptAi(booking: ReceiptAiFlagBooking): boolean {
  const isInvalid = (url: string | null | undefined, verdict: string | null | undefined) =>
    Boolean(url?.trim()) && String(verdict ?? '').toLowerCase() === 'invalid';

  return (
    isInvalid(booking.payment_receipt_url, booking.dp_receipt_ai_verdict) ||
    isInvalid(booking.guest_balance_payment_receipt_url, booking.balance_receipt_ai_verdict) ||
    isInvalid(booking.parking_payment_receipt_url, booking.parking_receipt_ai_verdict)
  );
}

/** Icon-only flag chips (table, card grid, calendar day panel). */
export const bookingFlagIconChipClass = {
  parking: flagIconChipClasses('parking'),
  pet: flagIconChipClasses('pet'),
  decor: flagIconChipClasses('decor'),
  invalidReceipt: flagIconChipClasses('invalidReceipt'),
} as const;
