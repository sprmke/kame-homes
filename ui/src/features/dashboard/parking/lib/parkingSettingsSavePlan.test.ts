import { describe, expect, it } from 'vitest';

import { planParkingSettingsSave } from '@/features/dashboard/parking/lib/parkingSettingsSavePlan';

describe('planParkingSettingsSave', () => {

  it('planParkingSettingsSave is exported', () => {
    expect(typeof planParkingSettingsSave).toBe('function');
  });

});
