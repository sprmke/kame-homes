import { describe, expect, it } from 'vitest';

import { applyBrandCssVariables } from '@/lib/theme/applyBrandCssVariables';

describe('applyBrandCssVariables', () => {

  it('applyBrandCssVariables is exported', () => {
    expect(typeof applyBrandCssVariables).toBe('function');
  });

});
