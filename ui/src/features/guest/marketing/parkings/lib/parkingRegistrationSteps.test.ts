import { describe, expect, it } from 'vitest';

import { getFieldsForParkingStep, isParkingStepComplete, clampParkingStep, PARKING_REGISTRATION_STEP_COUNT } from '@/features/guest/marketing/parkings/lib/parkingRegistrationSteps';

describe('getFieldsForParkingStep', () => {

  it('getFieldsForParkingStep is exported', () => {
    expect(typeof getFieldsForParkingStep).toBe('function');
  });

});

describe('isParkingStepComplete', () => {

  it('isParkingStepComplete is exported', () => {
    expect(typeof isParkingStepComplete).toBe('function');
  });

});

describe('clampParkingStep', () => {

  it('clampParkingStep is exported', () => {
    expect(typeof clampParkingStep).toBe('function');
  });

});

describe('PARKING_REGISTRATION_STEP_COUNT', () => {
  it('is defined', () => {
    expect(PARKING_REGISTRATION_STEP_COUNT).toBeDefined();
  });
});
