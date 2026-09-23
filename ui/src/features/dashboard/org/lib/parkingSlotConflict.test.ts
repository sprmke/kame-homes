import { describe, expect, it } from 'vitest';

import { findParkingSlotConflict } from '@/features/dashboard/org/lib/parkingSlotConflict';

describe('findParkingSlotConflict', () => {

  it('findParkingSlotConflict is exported', () => {
    expect(typeof findParkingSlotConflict).toBe('function');
  });

});
