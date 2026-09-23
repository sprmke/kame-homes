import { describe, expect, it } from 'vitest';

import { computeParkingSettingsCompletion, MIN_PARKING_AMENITIES } from '@/features/dashboard/parking/lib/parkingSettingsCompletion';

describe('computeParkingSettingsCompletion', () => {

  it('computeParkingSettingsCompletion is exported', () => {
    expect(typeof computeParkingSettingsCompletion).toBe('function');
  });

});

describe('MIN_PARKING_AMENITIES', () => {
  it('is defined', () => {
    expect(MIN_PARKING_AMENITIES).toBeDefined();
  });
});
