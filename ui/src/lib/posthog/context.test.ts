import { describe, expect, it } from 'vitest';

import { setAnalyticsScope, clearAnalyticsScope, setAnalyticsSignedIn, buildSharedAnalyticsProperties } from '@/lib/posthog/context';

describe('setAnalyticsScope', () => {

  it('setAnalyticsScope is exported', () => {
    expect(typeof setAnalyticsScope).toBe('function');
  });

});

describe('clearAnalyticsScope', () => {

  it('clearAnalyticsScope is exported', () => {
    expect(typeof clearAnalyticsScope).toBe('function');
  });

});

describe('setAnalyticsSignedIn', () => {

  it('setAnalyticsSignedIn is exported', () => {
    expect(typeof setAnalyticsSignedIn).toBe('function');
  });

});

describe('buildSharedAnalyticsProperties', () => {

  it('buildSharedAnalyticsProperties is exported', () => {
    expect(typeof buildSharedAnalyticsProperties).toBe('function');
  });

});
