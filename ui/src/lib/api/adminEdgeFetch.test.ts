import { describe, expect, it } from 'vitest';

import * as mod from '@/lib/api/adminEdgeFetch';

describe('adminEdgeFetch', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
