import { describe, expect, it } from 'vitest';

import { isOptimizationDisabled } from '@/lib/media/imageOptimization';

describe('isOptimizationDisabled', () => {

  it('isOptimizationDisabled is exported', () => {
    expect(typeof isOptimizationDisabled).toBe('function');
  });

});
