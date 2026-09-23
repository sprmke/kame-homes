import { describe, expect, it } from 'vitest';

import { computeMidCycleProration } from '@/features/dashboard/plans/lib/planProration';

describe('computeMidCycleProration', () => {

  it('computeMidCycleProration is exported', () => {
    expect(typeof computeMidCycleProration).toBe('function');
  });

});
