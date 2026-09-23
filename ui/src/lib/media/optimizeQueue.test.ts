import { describe, expect, it } from 'vitest';

import { getOptimizeConcurrency } from '@/lib/media/optimizeQueue';

describe('getOptimizeConcurrency', () => {

  it('getOptimizeConcurrency is exported', () => {
    expect(typeof getOptimizeConcurrency).toBe('function');
  });

});
