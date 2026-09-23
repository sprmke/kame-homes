import { describe, expect, it } from 'vitest';

import { yieldToMainThread, waitForMarketingIdle } from '@/features/dashboard/marketing/lib/marketingIdle';

describe('yieldToMainThread', () => {

  it('yieldToMainThread is exported', () => {
    expect(typeof yieldToMainThread).toBe('function');
  });

});

describe('waitForMarketingIdle', () => {

  it('waitForMarketingIdle is exported', () => {
    expect(typeof waitForMarketingIdle).toBe('function');
  });

});
