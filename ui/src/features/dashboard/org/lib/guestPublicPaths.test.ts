import { describe, expect, it } from 'vitest';

import * as mod from '@/features/dashboard/org/lib/guestPublicPaths';

describe('guestPublicPaths', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
