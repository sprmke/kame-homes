import { describe, expect, it } from 'vitest';

import { guestFormStepAnalyticsName, trackGuestFormStarted, trackGuestFormStepCompleted, trackGuestFormStepFailed, trackGuestFormAbandoned, clearGuestFormStartedMarker } from '@/lib/posthog/guestFormAnalytics';

describe('guestFormStepAnalyticsName', () => {

  it('guestFormStepAnalyticsName is exported', () => {
    expect(typeof guestFormStepAnalyticsName).toBe('function');
  });

});

describe('trackGuestFormStarted', () => {

  it('trackGuestFormStarted is exported', () => {
    expect(typeof trackGuestFormStarted).toBe('function');
  });

});

describe('trackGuestFormStepCompleted', () => {

  it('trackGuestFormStepCompleted is exported', () => {
    expect(typeof trackGuestFormStepCompleted).toBe('function');
  });

});

describe('trackGuestFormStepFailed', () => {

  it('trackGuestFormStepFailed is exported', () => {
    expect(typeof trackGuestFormStepFailed).toBe('function');
  });

});

describe('trackGuestFormAbandoned', () => {

  it('trackGuestFormAbandoned is exported', () => {
    expect(typeof trackGuestFormAbandoned).toBe('function');
  });

});

describe('clearGuestFormStartedMarker', () => {

  it('clearGuestFormStartedMarker is exported', () => {
    expect(typeof clearGuestFormStartedMarker).toBe('function');
  });

});
