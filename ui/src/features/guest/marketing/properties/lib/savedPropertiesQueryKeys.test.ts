import { describe, expect, it } from 'vitest';

import { savedPropertiesQueryKeys } from '@/features/guest/marketing/properties/lib/savedPropertiesQueryKeys';

describe('savedPropertiesQueryKeys', () => {
  it('is defined', () => {
    expect(savedPropertiesQueryKeys).toBeDefined();
  });
});
