import { describe, expect, it } from 'vitest';

import { parkingFlowTransition, PARKING_FLOW_EASE, parkingFlowFadeUp, parkingFlowStep } from '@/lib/parking/parkingFlowMotion';

describe('parkingFlowTransition', () => {

  it('parkingFlowTransition is exported', () => {
    expect(typeof parkingFlowTransition).toBe('function');
  });

});

describe('PARKING_FLOW_EASE', () => {
  it('is defined', () => {
    expect(PARKING_FLOW_EASE).toBeDefined();
  });
});

describe('parkingFlowFadeUp', () => {
  it('is defined', () => {
    expect(parkingFlowFadeUp).toBeDefined();
  });
});

describe('parkingFlowStep', () => {
  it('is defined', () => {
    expect(parkingFlowStep).toBeDefined();
  });
});
