import { describe, expect, it } from 'vitest';

import {
  getGuestFormStepCount,
  getGuestFormSteps,
  isGuestFormStepComplete,
} from '@/features/guest/form/lib/guestFormSteps';
import type {
  GuestFormData,
  GuestFormSchemaOptions,
} from '@/features/guest/form/schemas/guestFormSchema';

const flags: GuestFormSchemaOptions & { residenceName: string | null } = {
  isAirbnb: false,
  allowParking: true,
  allowPets: true,
  allowSurpriseDecor: false,
  maxAdults: 4,
  maxChildren: 2,
  residenceName: null,
};

function makeReceiptFile() {
  return new File(['receipt'], 'receipt.png', { type: 'image/png' });
}

function makeValidIdFile() {
  return new File(['id'], 'valid-id.png', { type: 'image/png' });
}

function makeStepOneValues(overrides: Partial<GuestFormData> = {}): GuestFormData {
  return {
    guestFacebookName: 'Test Test',
    guestEmail: 'test@example.com',
    guestPhoneNumber: '09171234567',
    guestAddress: 'San Fernando, Pampanga',
    nationality: 'Filipino',
    primaryGuestName: 'Test Test',
    primaryGuestAge: 18,
    numberOfAdults: 1,
    numberOfChildren: 0,
    checkInDate: '2026-11-10',
    checkOutDate: '2026-11-12',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    findUs: 'Facebook',
    ...overrides,
  } as GuestFormData;
}

describe('guestFormSteps', () => {
  it('skips payment step for Airbnb bookings', () => {
    const airbnbFlags = { ...flags, isAirbnb: true };
    const steps = getGuestFormSteps(airbnbFlags);
    expect(steps.some((step) => step.title === 'Payment')).toBe(false);
    expect(getGuestFormStepCount(airbnbFlags)).toBe(4);
  });

  it('includes payment step for direct bookings', () => {
    const directFlags = { ...flags, allowParking: false, allowPets: false };
    const steps = getGuestFormSteps(directFlags);
    expect(steps.map((step) => step.title)).toEqual(['Guest', 'Stay', 'Payment']);
  });

  describe('isGuestFormStepComplete', () => {
    it('blocks step 1 when a guest aged 18+ has no Valid ID', () => {
      expect(isGuestFormStepComplete(1, makeStepOneValues(), flags)).toBe(false);
    });

    it('allows step 1 once the Valid ID is uploaded', () => {
      expect(
        isGuestFormStepComplete(1, makeStepOneValues({ validId: makeValidIdFile() }), flags)
      ).toBe(true);
    });

    it('blocks step 1 when an additional guest aged 18+ has no Valid ID', () => {
      const values = makeStepOneValues({
        validId: makeValidIdFile(),
        guest2Name: 'Second Guest',
        guest2Age: 20,
      });
      expect(isGuestFormStepComplete(1, values, flags)).toBe(false);
      expect(
        isGuestFormStepComplete(1, { ...values, guest2ValidId: makeValidIdFile() }, flags)
      ).toBe(true);
    });

    it('keeps cross-field rules active while the payment receipt is still missing', () => {
      const stayValues = makeStepOneValues({ findUs: 'Friend', findUsDetails: '' });
      expect(isGuestFormStepComplete(2, stayValues, flags)).toBe(false);

      const petValues = makeStepOneValues({ hasPets: true });
      expect(isGuestFormStepComplete(4, petValues, flags)).toBe(false);

      const receiptMissing = makeStepOneValues({ validId: makeValidIdFile() });
      expect(isGuestFormStepComplete(5, receiptMissing, flags)).toBe(false);
      expect(
        isGuestFormStepComplete(5, { ...receiptMissing, paymentReceipt: makeReceiptFile() }, flags)
      ).toBe(true);
    });
  });
});
