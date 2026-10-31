import { describe, expect, it } from 'vitest';

import * as mod from '@/features/guest/marketing/shared/lib/publicListingFetch';

describe('publicListingFetch', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
