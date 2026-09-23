import { describe, expect, it } from 'vitest';

import { formatParkingLocation } from '@/features/guest/marketing/parkings/lib/formatParkingLocation';

describe('formatParkingLocation', () => {

  it('formatParkingLocation is exported', () => {
    expect(typeof formatParkingLocation).toBe('function');
  });

});
