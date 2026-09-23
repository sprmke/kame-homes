import { describe, expect, it } from 'vitest';

import { buildEmptyParkingDashboardStats } from '@/features/dashboard/parking/lib/parkingDashboardStats';

describe('buildEmptyParkingDashboardStats', () => {

  it('buildEmptyParkingDashboardStats is exported', () => {
    expect(typeof buildEmptyParkingDashboardStats).toBe('function');
  });

});
