import { describe, expect, it } from 'vitest';

import { assignUniqueChartColors } from '@/lib/charts/chartPalette';

describe('assignUniqueChartColors', () => {

  it('assignUniqueChartColors is exported', () => {
    expect(typeof assignUniqueChartColors).toBe('function');
  });

});
