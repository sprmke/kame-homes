import { describe, expect, it } from 'vitest';

import * as mod from '@/features/dashboard/marketing/lib/designCanvasTypes';

describe('designCanvasTypes', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
