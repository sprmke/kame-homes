/**
 * WorkflowPanel sub-form draft state — pure relocation from the pre-decomposition
 * `WorkflowPanel.tsx` (the 5 `useState`s + `buildPayload`/`isTransitionDisabled`).
 * No new logic: same `lib/workflow.ts#requiredSubForm` call, same field mapping.
 * Also tracks dirty state for Progress rail Save (browsed stages) and live autosave.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { GuestBalanceSettlementValues } from '@/features/dashboard/bookings/components/GuestBalanceSettlementForm';
import type { GuestSdRefundEditValues } from '@/features/dashboard/bookings/components/GuestSdRefundEditForm';
import {
  isParkingRequestDraftComplete,
  type ParkingRequestValues,
} from '@/features/dashboard/bookings/components/ParkingRequestForm';
import type { ReviewPricingFormValues } from '@/features/dashboard/bookings/components/ReviewPricingForm';
import type { SdRefundValues } from '@/features/dashboard/bookings/components/SdRefundForm';
import type { TransitionPayload } from '@/features/dashboard/bookings/hooks/useTransitionBooking';
import type { BookingStatus } from '@/features/dashboard/bookings/lib/bookingStatus';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import { requiredSubForm } from '@/features/dashboard/bookings/lib/workflow';

export function useWorkflowSubFormDrafts(
  booking: BookingRow,
  status: BookingStatus,
  /** Reset dirty when the host browses to another stage. */
  viewedContentKey?: string | null
) {
  const hydrationDone = useRef(false);
  const [progressDirty, setProgressDirty] = useState(false);

  useEffect(() => {
    hydrationDone.current = false;
    setProgressDirty(false);
    const t = setTimeout(() => {
      hydrationDone.current = true;
    }, 400);
    return () => clearTimeout(t);
  }, [booking.id, status, viewedContentKey]);

  const markDirty = useCallback(() => {
    if (hydrationDone.current) setProgressDirty(true);
  }, []);

  const clearProgressDirty = useCallback(() => {
    setProgressDirty(false);
  }, []);

  const [pricingValues, setPricingValuesState] = useState<ReviewPricingFormValues | null>(null);
  const [surpriseDecorStaffAck, setSurpriseDecorStaffAckState] = useState(
    () => !!booking.surprise_decor_staff_acknowledged
  );

  useEffect(() => {
    setSurpriseDecorStaffAckState(!!booking.surprise_decor_staff_acknowledged);
  }, [booking.id, booking.surprise_decor_staff_acknowledged]);

  const [parkingValues, setParkingValuesState] = useState<ParkingRequestValues | null>(null);
  const [sdRefundValues, setSdRefundValuesState] = useState<SdRefundValues | null>(null);
  const [guestBalanceValues, setGuestBalanceValuesState] =
    useState<GuestBalanceSettlementValues | null>(null);
  const [sdRefundGuestValues, setSdRefundGuestValuesState] =
    useState<GuestSdRefundEditValues | null>(null);

  const setPricingValues = useCallback(
    (values: ReviewPricingFormValues | null) => {
      setPricingValuesState(values);
      markDirty();
    },
    [markDirty]
  );

  const setSurpriseDecorStaffAck = useCallback(
    (value: boolean) => {
      setSurpriseDecorStaffAckState(value);
      markDirty();
    },
    [markDirty]
  );

  const setParkingValues = useCallback(
    (values: ParkingRequestValues | null) => {
      setParkingValuesState(values);
      markDirty();
    },
    [markDirty]
  );

  const setSdRefundValues = useCallback(
    (values: SdRefundValues | null) => {
      setSdRefundValuesState(values);
      markDirty();
    },
    [markDirty]
  );

  const setGuestBalanceValues = useCallback(
    (values: GuestBalanceSettlementValues | null) => {
      setGuestBalanceValuesState(values);
      markDirty();
    },
    [markDirty]
  );

  const setSdRefundGuestValues = useCallback(
    (values: GuestSdRefundEditValues | null) => {
      setSdRefundGuestValuesState(values);
      markDirty();
    },
    [markDirty]
  );

  const buildPayload = useCallback(
    (toStatus: BookingStatus): TransitionPayload => {
      const subForm = requiredSubForm(status, toStatus);
      if (subForm === 'pricing' && pricingValues) {
        const base = {
          booking_rate: pricingValues.booking_rate,
          down_payment: pricingValues.down_payment,
          security_deposit: pricingValues.security_deposit,
          pet_fee: booking.has_pets === true ? pricingValues.pet_fee : 0,
          parking_rate_guest: booking.need_parking === true ? pricingValues.parking_rate_guest : 0,
          guest_additional_fee: pricingValues.guest_additional_fee,
          ...(pricingValues.applied_voucher_discount_php != null
            ? { applied_voucher_discount_php: pricingValues.applied_voucher_discount_php }
            : {}),
        };
        if (booking.guest_requests_surprise_decor && surpriseDecorStaffAck) {
          return {
            ...base,
            surprise_decor_staff_acknowledged: true,
          };
        }
        return base;
      }
      if (subForm === 'parking' && parkingValues) {
        return {
          parking_owner: parkingValues.parking_owner.trim() || null,
          parking_rate_paid: parkingValues.parking_rate_paid,
          parking_endorsement_url: parkingValues.parking_endorsement_url || null,
          parking_fee_included_in_downpayment: parkingValues.parking_fee_included_in_downpayment,
          parking_payment_receipt_url: parkingValues.parking_fee_included_in_downpayment
            ? null
            : parkingValues.parking_payment_receipt_url || null,
        };
      }
      if (subForm === 'sd_refund' && sdRefundValues) {
        return {
          sd_additional_expenses: sdRefundValues.sd_additional_expense_items.map(
            (r) => Number(r.amount) || 0
          ),
          sd_additional_profits: sdRefundValues.sd_additional_profit_items.map(
            (r) => Number(r.amount) || 0
          ),
          sd_refund_amount: sdRefundValues.sd_refund_amount,
          sd_refund_receipt_url: sdRefundValues.sd_refund_receipt_url || null,
        };
      }
      if (subForm === 'guest_balance' && guestBalanceValues) {
        return {
          guest_balance_paid_amount: guestBalanceValues.guest_balance_paid_amount,
          guest_balance_payment_receipt_url:
            guestBalanceValues.guest_balance_payment_receipt_url || null,
        };
      }
      return {};
    },
    [
      status,
      pricingValues,
      booking.has_pets,
      booking.need_parking,
      booking.guest_requests_surprise_decor,
      surpriseDecorStaffAck,
      parkingValues,
      sdRefundValues,
      guestBalanceValues,
    ]
  );

  const isTransitionDisabled = useCallback(
    (toStatus: BookingStatus): boolean => {
      const subForm = requiredSubForm(status, toStatus);
      if (subForm === 'pricing') {
        if (pricingValues === null) return true;
        if (booking.guest_requests_surprise_decor && !surpriseDecorStaffAck) {
          return true;
        }
        return false;
      }
      if (subForm === 'parking') return !isParkingRequestDraftComplete(parkingValues);
      if (subForm === 'sd_refund') return sdRefundValues === null;
      if (subForm === 'guest_balance') return guestBalanceValues === null;
      return false;
    },
    [
      status,
      pricingValues,
      booking.guest_requests_surprise_decor,
      surpriseDecorStaffAck,
      parkingValues,
      sdRefundValues,
      guestBalanceValues,
    ]
  );

  return {
    pricingValues,
    setPricingValues,
    surpriseDecorStaffAck,
    setSurpriseDecorStaffAck,
    parkingValues,
    setParkingValues,
    sdRefundValues,
    setSdRefundValues,
    guestBalanceValues,
    setGuestBalanceValues,
    sdRefundGuestValues,
    setSdRefundGuestValues,
    progressDirty,
    clearProgressDirty,
    buildPayload,
    isTransitionDisabled,
  };
}

export type WorkflowSubFormDrafts = ReturnType<typeof useWorkflowSubFormDrafts>;
