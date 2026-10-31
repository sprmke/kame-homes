import { describe, expect, it } from 'vitest';

import * as mod from '@/features/dashboard/marketing/lib/polotno/syncPolotnoTextBounds';

describe('syncPolotnoTextBounds', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
