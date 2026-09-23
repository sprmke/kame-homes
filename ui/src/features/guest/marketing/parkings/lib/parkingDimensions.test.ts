import { describe, expect, it } from 'vitest';

import { formatParkingDimensionMeters } from '@/features/guest/marketing/parkings/lib/parkingDimensions';

describe('formatParkingDimensionMeters', () => {

  it('formatParkingDimensionMeters is exported', () => {
    expect(typeof formatParkingDimensionMeters).toBe('function');
  });

});
