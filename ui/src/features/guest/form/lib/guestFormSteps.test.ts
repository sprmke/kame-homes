import { describe, expect, it } from 'vitest';

import { getGuestFormStepCount, getGuestFormSteps } from '@/features/guest/form/lib/guestFormSteps';

describe('guestFormSteps', () => {
  it('skips payment step for Airbnb bookings', () => {
    const flags = {
      isAirbnb: true,
      allowParking: true,
      allowPets: true,
      allowSurpriseDecor: false,
      maxAdults: 4,
      maxChildren: 2,
      residenceName: 'Solea Residences',
    };
    const steps = getGuestFormSteps(flags);
    expect(steps.some((step) => step.title === 'Payment')).toBe(false);
    expect(getGuestFormStepCount(flags)).toBe(4);
  });

  it('includes payment step for direct bookings', () => {
    const flags = {
      isAirbnb: false,
      allowParking: false,
      allowPets: false,
      allowSurpriseDecor: false,
      maxAdults: 4,
      maxChildren: 2,
      residenceName: null,
    };
    const steps = getGuestFormSteps(flags);
    expect(steps.map((step) => step.title)).toEqual(['Guest', 'Stay', 'Payment']);
  });
});
