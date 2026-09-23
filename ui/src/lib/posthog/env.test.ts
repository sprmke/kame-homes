import { describe, expect, it } from 'vitest';

import { detectAnalyticsEnvironment, detectAppTrack, resolvePostHogApiHost } from '@/lib/posthog/env';

describe('detectAnalyticsEnvironment', () => {

  it('detectAnalyticsEnvironment is exported', () => {
    expect(typeof detectAnalyticsEnvironment).toBe('function');
  });

});

describe('detectAppTrack', () => {

  it('detectAppTrack is exported', () => {
    expect(typeof detectAppTrack).toBe('function');
  });

});

describe('resolvePostHogApiHost', () => {

  it('resolvePostHogApiHost is exported', () => {
    expect(typeof resolvePostHogApiHost).toBe('function');
  });

});
