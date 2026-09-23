import { describe, expect, it } from 'vitest';

import { isParkingStatus, canTransition, availableTransitions, PARKING_STATUSES } from '@/features/dashboard/parking/lib/parkingWorkflow';

describe('isParkingStatus', () => {

  it('isParkingStatus is exported', () => {
    expect(typeof isParkingStatus).toBe('function');
  });

});

describe('canTransition', () => {

  it('canTransition is exported', () => {
    expect(typeof canTransition).toBe('function');
  });

});

describe('availableTransitions', () => {

  it('availableTransitions is exported', () => {
    expect(typeof availableTransitions).toBe('function');
  });

});

describe('PARKING_STATUSES', () => {
  it('is defined', () => {
    expect(PARKING_STATUSES).toBeDefined();
  });
});
