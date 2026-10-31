/**
 * Progress-form values → `useUpdateBooking` patch (workflow rail Save).
 */

import type { GuestBalanceSettlementValues } from '@/features/dashboard/bookings/components/GuestBalanceSettlementForm';
import {
  guestSdRefundPayloadFromValues,
  type GuestSdRefundEditValues,
} from '@/features/dashboard/bookings/components/GuestSdRefundEditForm';
import type { ParkingRequestValues } from '@/features/dashboard/bookings/components/ParkingRequestForm';
import type { ReviewPricingFormValues } from '@/features/dashboard/bookings/components/ReviewPricingForm';
import type { SdRefundValues } from '@/features/dashboard/bookings/components/SdRefundForm';
import type { UpdateBookingPayload } from '@/features/dashboard/bookings/hooks/useUpdateBooking';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import type { WorkflowViewContent } from '@/features/dashboard/bookings/lib/workflow';

export type WorkflowProgressDrafts = {
  pricing: ReviewPricingFormValues | null;
  parking: ParkingRequestValues | null;
  guestBalance: GuestBalanceSettlementValues | null;
  sdRefund: SdRefundValues | null;
  sdRefundGuest: GuestSdRefundEditValues | null;
  surpriseDecorStaffAck: boolean;
};

/** Stages that expose an editable progress form in the rail. */
export function isEditableWorkflowProgressContent(
  content: WorkflowViewContent | null
): content is 'pricing' | 'parking' | 'guest_balance' | 'sd_refund' {
  return (
    content === 'pricing' ||
    content === 'parking' ||
    content === 'guest_balance' ||
    content === 'sd_refund'
  );
}

export function progressSavePayloadForView(
  booking: BookingRow,
  viewedContent: WorkflowViewContent | null,
  drafts: WorkflowProgressDrafts
): Partial<UpdateBookingPayload> | null {
  if (!isEditableWorkflowProgressContent(viewedContent)) return null;

  if (viewedContent === 'pricing') {
    if (!drafts.pricing) return null;
    const p = drafts.pricing;
    const patch: Partial<UpdateBookingPayload> = {
      booking_rate: p.booking_rate,
      down_payment: p.down_payment,
      security_deposit: p.security_deposit,
      pet_fee: booking.has_pets ? p.pet_fee : 0,
      parking_rate_guest: booking.need_parking ? p.parking_rate_guest : 0,
      guest_additional_fee: p.guest_additional_fee ?? 0,
    };
    if (booking.guest_requests_surprise_decor && drafts.surpriseDecorStaffAck) {
      patch.surprise_decor_staff_acknowledged = true;
    }
    return patch;
  }

  if (viewedContent === 'parking') {
    if (!booking.need_parking || !drafts.parking) return null;
    const parking = drafts.parking;
    const patch: Partial<UpdateBookingPayload> = {
      parking_owner: parking.parking_owner.trim() || null,
      parking_rate_paid: parking.parking_rate_paid,
      parking_endorsement_url: parking.parking_endorsement_url || null,
      parking_fee_included_in_downpayment: parking.parking_fee_included_in_downpayment,
      parking_payment_receipt_url: parking.parking_fee_included_in_downpayment
        ? null
        : parking.parking_payment_receipt_url || null,
    };
    if (
      !parking.parking_fee_included_in_downpayment &&
      !parking.parking_payment_receipt_url?.trim()
    ) {
      patch.parking_receipt_ai_verdict = null;
      patch.parking_receipt_ai_summary = null;
    }
    return patch;
  }

  if (viewedContent === 'guest_balance') {
    if (!drafts.guestBalance) return null;
    const g = drafts.guestBalance;
    const patch: Partial<UpdateBookingPayload> = {
      guest_balance_paid_amount: g.guest_balance_paid_amount,
      guest_balance_payment_receipt_url: g.guest_balance_payment_receipt_url || null,
    };
    if (!g.guest_balance_payment_receipt_url?.trim()) {
      patch.balance_receipt_ai_verdict = null;
      patch.balance_receipt_ai_summary = null;
    }
    return patch;
  }

  // sd_refund — settlement + optional guest refund details
  const patch: Partial<UpdateBookingPayload> = {};
  if (drafts.sdRefund) {
    const sd = drafts.sdRefund;
    patch.sd_additional_expense_items = sd.sd_additional_expense_items;
    patch.sd_additional_profit_items = sd.sd_additional_profit_items;
    patch.sd_additional_expenses = sd.sd_additional_expense_items.map((r) => Number(r.amount) || 0);
    patch.sd_additional_profits = sd.sd_additional_profit_items.map((r) => Number(r.amount) || 0);
    patch.sd_refund_amount = sd.sd_refund_amount;
    patch.sd_refund_receipt_url = sd.sd_refund_receipt_url || null;
  }
  if (drafts.sdRefundGuest) {
    Object.assign(patch, guestSdRefundPayloadFromValues(drafts.sdRefundGuest));
  }
  return Object.keys(patch).length > 0 ? patch : null;
}
