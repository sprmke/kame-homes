import { describe, expect, it } from 'vitest';

import {
  isEditableWorkflowProgressContent,
  progressSavePayloadForView,
} from '@/features/dashboard/bookings/lib/bookingProgressEditPayload';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

const booking = {
  has_pets: true,
  need_parking: true,
  guest_requests_surprise_decor: true,
} as BookingRow;

describe('isEditableWorkflowProgressContent', () => {
  it('returns true for editable rail views', () => {
    expect(isEditableWorkflowProgressContent('pricing')).toBe(true);
    expect(isEditableWorkflowProgressContent('guest_balance')).toBe(true);
  });

  it('returns false for non-form views', () => {
    expect(isEditableWorkflowProgressContent('completed_summary')).toBe(false);
    expect(isEditableWorkflowProgressContent(null)).toBe(false);
  });
});

describe('progressSavePayloadForView', () => {
  it('builds pricing patch and clears pet/parking fees when flags off', () => {
    const patch = progressSavePayloadForView(
      { ...booking, has_pets: false, need_parking: false } as BookingRow,
      'pricing',
      {
        pricing: {
          booking_rate: 10000,
          down_payment: 2000,
          security_deposit: 3000,
          pet_fee: 500,
          parking_rate_guest: 400,
          guest_additional_fee: 100,
        },
        parking: null,
        guestBalance: null,
        sdRefund: null,
        sdRefundGuest: null,
        surpriseDecorStaffAck: false,
      }
    );
    expect(patch).toMatchObject({
      booking_rate: 10000,
      pet_fee: 0,
      parking_rate_guest: 0,
      guest_additional_fee: 100,
    });
  });

  it('sets surprise decor ack when staff confirms', () => {
    const patch = progressSavePayloadForView(booking, 'pricing', {
      pricing: {
        booking_rate: 1,
        down_payment: 0,
        security_deposit: 0,
        pet_fee: 0,
        parking_rate_guest: 0,
        guest_additional_fee: 0,
      },
      parking: null,
      guestBalance: null,
      sdRefund: null,
      sdRefundGuest: null,
      surpriseDecorStaffAck: true,
    });
    expect(patch?.surprise_decor_staff_acknowledged).toBe(true);
  });

  it('returns null when view is not editable', () => {
    expect(
      progressSavePayloadForView(booking, 'completed_summary', {
        pricing: null,
        parking: null,
        guestBalance: null,
        sdRefund: null,
        sdRefundGuest: null,
        surpriseDecorStaffAck: false,
      })
    ).toBeNull();
  });
});
