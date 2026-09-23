import { describe, expect, it } from 'vitest';

import { formatParkingLocation } from '@/features/dashboard/org/lib/formatParkingLocation';

describe('formatParkingLocation', () => {

  it('formatParkingLocation is exported', () => {
    expect(typeof formatParkingLocation).toBe('function');
  });

});
