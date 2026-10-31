import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  holdMarketingRenders,
  releaseMarketingRenders,
  resetMarketingRenderGate,
  whenMarketingRendersAllowed,
} from '@/features/dashboard/marketing/lib/marketingRenderGate';

describe('marketingRenderGate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetMarketingRenderGate();
  });
  afterEach(() => {
    resetMarketingRenderGate();
    vi.useRealTimers();
  });

  it('lets renders through when nobody holds them', async () => {
    vi.advanceTimersByTime(5000);
    await expect(whenMarketingRendersAllowed()).resolves.toBeUndefined();
  });

  it('waits while held and for a quiet period after release', async () => {
    vi.advanceTimersByTime(5000);
    holdMarketingRenders();
    let done = false;
    void whenMarketingRendersAllowed().then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(3000);
    expect(done).toBe(false);
    releaseMarketingRenders();
    await vi.advanceTimersByTimeAsync(500);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(800);
    expect(done).toBe(true);
  });

  it('stays closed while a second hold is active', async () => {
    vi.advanceTimersByTime(5000);
    holdMarketingRenders();
    holdMarketingRenders();
    let done = false;
    void whenMarketingRendersAllowed().then(() => {
      done = true;
    });
    releaseMarketingRenders();
    await vi.advanceTimersByTimeAsync(3000);
    expect(done).toBe(false);
    releaseMarketingRenders();
    await vi.advanceTimersByTimeAsync(1300);
    expect(done).toBe(true);
  });
});
