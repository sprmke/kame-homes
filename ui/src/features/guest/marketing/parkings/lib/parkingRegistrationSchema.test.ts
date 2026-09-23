import { describe, expect, it } from 'vitest';

import { parkingVehicleTypeOptions, parkingRegistrationSchema } from '@/features/guest/marketing/parkings/lib/parkingRegistrationSchema';

describe('parkingVehicleTypeOptions', () => {
  it('is defined', () => {
    expect(parkingVehicleTypeOptions).toBeDefined();
  });
});

describe('parkingRegistrationSchema', () => {
  it('is defined', () => {
    expect(parkingRegistrationSchema).toBeDefined();
  });
});
