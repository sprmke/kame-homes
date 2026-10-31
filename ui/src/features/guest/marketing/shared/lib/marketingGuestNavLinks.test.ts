import { describe, expect, it } from 'vitest';

import { marketingGuestNavLinks } from '@/features/guest/marketing/shared/lib/marketingGuestNavLinks';

describe('marketingGuestNavLinks', () => {
  it('is defined', () => {
    expect(marketingGuestNavLinks).toBeDefined();
  });
});
