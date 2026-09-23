import { describe, expect, it } from 'vitest';

import { featureGateCopy } from '@/features/dashboard/plans/lib/featureGateCopy';

describe('featureGateCopy', () => {

  it('featureGateCopy is exported', () => {
    expect(typeof featureGateCopy).toBe('function');
  });

});
