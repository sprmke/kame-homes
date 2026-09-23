import { describe, expect, it } from 'vitest';

import { resolveParkingLocationBadge, formatParkingSlotLocation } from '@/features/guest/marketing/developments/lib/parkingSlotDisplay';

describe('resolveParkingLocationBadge', () => {

  it('resolveParkingLocationBadge is exported', () => {
    expect(typeof resolveParkingLocationBadge).toBe('function');
  });

});

describe('formatParkingSlotLocation', () => {

  it('formatParkingSlotLocation is exported', () => {
    expect(typeof formatParkingSlotLocation).toBe('function');
  });

});
