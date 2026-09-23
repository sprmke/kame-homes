import { describe, expect, it } from 'vitest';

import * as mod from '@/features/guest/sd-form/lib/sdFormSteps';

describe('sdFormSteps', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
