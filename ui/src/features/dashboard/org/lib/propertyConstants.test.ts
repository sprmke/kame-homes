import { describe, expect, it } from 'vitest';

import { DEFAULT_RESIDENCE_NAME } from '@/features/dashboard/org/lib/propertyConstants';

describe('DEFAULT_RESIDENCE_NAME', () => {
  it('is defined', () => {
    expect(DEFAULT_RESIDENCE_NAME).toBeDefined();
  });
});
