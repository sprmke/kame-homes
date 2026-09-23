import { describe, expect, it } from 'vitest';

import * as mod from '@/features/guest/auth/lib/guestEdgeAuthHeaders';

describe('guestEdgeAuthHeaders', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
