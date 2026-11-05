import { describe, expect, it } from 'vitest';

import {
  getAnalyticsMode,
  setAnalyticsMode,
  shouldCaptureProductEvents,
  shouldAutocapture,
} from '@/lib/posthog/analyticsMode';

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

describe('retired errors_only', () => {
  it('reads a stored errors_only value as off, not as the compiled default', () => {
    const store = new Map<string, string>([['gfm:analytics_mode', 'errors_only']]);
    const original = globalThis.localStorage;
    // Minimal stand-in so the test does not depend on a DOM environment.
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
      configurable: true,
      writable: true,
    });
    try {
      expect(getAnalyticsMode()).toBe('off');
      // Suppressing capture is the whole point: falling back to `full` would capture
      // events the stored setting was there to prevent.
      expect(shouldCaptureProductEvents()).toBe(false);
      expect(shouldAutocapture()).toBe(false);
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        value: original,
        configurable: true,
        writable: true,
      });
    }
  });
});
