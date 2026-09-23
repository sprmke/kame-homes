import { describe, expect, it } from 'vitest';

import { getAnalyticsMode, setAnalyticsMode, shouldCaptureProductEvents, shouldAutocapture } from '@/lib/posthog/analyticsMode';

describe('getAnalyticsMode', () => {

  it('getAnalyticsMode is exported', () => {
    expect(typeof getAnalyticsMode).toBe('function');
  });

});

describe('setAnalyticsMode', () => {

  it('setAnalyticsMode is exported', () => {
    expect(typeof setAnalyticsMode).toBe('function');
  });

});

describe('shouldCaptureProductEvents', () => {

  it('shouldCaptureProductEvents is exported', () => {
    expect(typeof shouldCaptureProductEvents).toBe('function');
  });

});

describe('shouldAutocapture', () => {

  it('shouldAutocapture is exported', () => {
    expect(typeof shouldAutocapture).toBe('function');
  });

});
