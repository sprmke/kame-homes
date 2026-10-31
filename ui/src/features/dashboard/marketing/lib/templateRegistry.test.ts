import { describe, expect, it } from 'vitest';

import * as mod from '@/features/dashboard/marketing/lib/templateRegistry';

describe('templateRegistry', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
