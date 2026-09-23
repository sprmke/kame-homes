import { describe, expect, it } from 'vitest';

import { MARKETING_PUBLISH_META_LABEL } from '@/features/dashboard/marketing/lib/marketingStudioCopy';

describe('MARKETING_PUBLISH_META_LABEL', () => {
  it('is defined', () => {
    expect(MARKETING_PUBLISH_META_LABEL).toBeDefined();
  });
});
