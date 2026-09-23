import { describe, expect, it } from 'vitest';

import { parkingTypeLabel } from '@/features/guest/marketing/parkings/lib/parkingTypeLabel';

describe('parkingTypeLabel', () => {

  it('parkingTypeLabel is exported', () => {
    expect(typeof parkingTypeLabel).toBe('function');
  });

});
