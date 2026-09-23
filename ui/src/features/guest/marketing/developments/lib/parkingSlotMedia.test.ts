import { describe, expect, it } from 'vitest';

import { resolveParkingSlotImage } from '@/features/guest/marketing/developments/lib/parkingSlotMedia';

describe('resolveParkingSlotImage', () => {

  it('resolveParkingSlotImage is exported', () => {
    expect(typeof resolveParkingSlotImage).toBe('function');
  });

});
