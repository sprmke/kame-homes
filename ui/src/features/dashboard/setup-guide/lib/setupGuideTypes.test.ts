import { describe, expect, it } from 'vitest';

import { SETUP_GUIDE_STATE_VERSION } from '@/features/dashboard/setup-guide/lib/setupGuideTypes';

describe('SETUP_GUIDE_STATE_VERSION', () => {
  it('is defined', () => {
    expect(SETUP_GUIDE_STATE_VERSION).toBeDefined();
  });
});
