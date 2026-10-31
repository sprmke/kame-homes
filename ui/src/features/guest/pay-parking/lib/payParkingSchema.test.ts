import { describe, expect, it } from 'vitest';

import { payParkingVehicleSchema } from '@/features/guest/pay-parking/lib/payParkingSchema';

describe('payParkingVehicleSchema', () => {
  it('is defined', () => {
    expect(payParkingVehicleSchema).toBeDefined();
  });
});
