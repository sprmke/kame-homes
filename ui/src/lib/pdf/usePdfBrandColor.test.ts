import { describe, expect, it } from 'vitest';

import { usePdfBrandColor } from '@/lib/pdf/usePdfBrandColor';

describe('usePdfBrandColor', () => {

  it('usePdfBrandColor is exported', () => {
    expect(typeof usePdfBrandColor).toBe('function');
  });

});
