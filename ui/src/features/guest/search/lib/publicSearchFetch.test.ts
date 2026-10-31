import { describe, expect, it } from 'vitest';

import * as mod from '@/features/guest/search/lib/publicSearchFetch';

describe('publicSearchFetch', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
