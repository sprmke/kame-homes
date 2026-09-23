import { describe, expect, it } from 'vitest';

import * as mod from '@/features/dashboard/analytics/lib/metricGlossary';

describe('metricGlossary', () => {
  it('loads module', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});
