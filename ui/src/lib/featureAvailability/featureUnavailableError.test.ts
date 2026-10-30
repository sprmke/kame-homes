import { describe, expect, it } from 'vitest';

import {
  FEATURE_UNAVAILABLE_CODE,
  FeatureUnavailableMutationError,
  parseFeatureUnavailable,
  throwIfFeatureUnavailableBody,
} from '@/lib/featureAvailability/featureUnavailableError';
import { selectFeatureAvailabilityEntry } from '@/lib/featureAvailability/useFeatureAvailability';

describe('parseFeatureUnavailable', () => {
  it('parses FEATURE_UNAVAILABLE envelope', () => {
    const parsed = parseFeatureUnavailable({
      success: false,
      code: FEATURE_UNAVAILABLE_CODE,
      error: 'Under maintenance',
      feature: 'inbox.meta',
    });
    expect(parsed?.error).toBe('Under maintenance');
    expect(parsed?.feature).toBe('inbox.meta');
  });

  it('returns null for other errors', () => {
    expect(parseFeatureUnavailable({ code: 'OTHER', error: 'nope' })).toBeNull();
  });

  it('throwIfFeatureUnavailableBody throws FeatureUnavailableMutationError', () => {
    expect(() =>
      throwIfFeatureUnavailableBody({
        success: false,
        code: FEATURE_UNAVAILABLE_CODE,
        error: 'Paused',
      })
    ).toThrow(FeatureUnavailableMutationError);
  });
});

describe('selectFeatureAvailabilityEntry fail-open', () => {
  it('defaults to available while snapshot is undefined', () => {
    const view = selectFeatureAvailabilityEntry(undefined, 'inbox.meta');
    expect(view.available).toBe(true);
    expect(view.isLoading).toBe(false);
  });

  it('marks unavailable when entry is off', () => {
    const view = selectFeatureAvailabilityEntry(
      {
        serverNow: '2026-10-28T10:00:00.000Z',
        serverSkewMs: 0,
        entries: [
          {
            key: 'inbox.meta',
            available: false,
            bypassed: false,
            reason: 'maintenance',
            message: "We're working on this right now. It'll be back soon.",
            expectedBackAt: null,
            source: 'self',
            showBanner: false,
            updatedAt: '2026-10-28T09:00:00.000Z',
          },
        ],
      },
      'inbox.meta'
    );
    expect(view.available).toBe(false);
    expect(view.label).toBe('Under maintenance');
  });
});
