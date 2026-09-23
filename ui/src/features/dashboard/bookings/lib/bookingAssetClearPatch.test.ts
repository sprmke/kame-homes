import { describe, expect, it } from 'vitest';

import { bookingAssetClearPatch } from '@/features/dashboard/bookings/lib/bookingAssetClearPatch';

describe('bookingAssetClearPatch', () => {

  it('bookingAssetClearPatch is exported', () => {
    expect(typeof bookingAssetClearPatch).toBe('function');
  });

});
