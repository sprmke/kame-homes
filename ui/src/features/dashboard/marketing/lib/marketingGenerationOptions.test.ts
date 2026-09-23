import { describe, expect, it } from 'vitest';

import { imageTierOptions, videoTierOptions, imageSizeOptions, maxReferencesForTier, VIDEO_MAX_REFERENCES } from '@/features/dashboard/marketing/lib/marketingGenerationOptions';

describe('imageTierOptions', () => {

  it('imageTierOptions is exported', () => {
    expect(typeof imageTierOptions).toBe('function');
  });

});

describe('videoTierOptions', () => {

  it('videoTierOptions is exported', () => {
    expect(typeof videoTierOptions).toBe('function');
  });

});

describe('imageSizeOptions', () => {

  it('imageSizeOptions is exported', () => {
    expect(typeof imageSizeOptions).toBe('function');
  });

});

describe('maxReferencesForTier', () => {

  it('maxReferencesForTier is exported', () => {
    expect(typeof maxReferencesForTier).toBe('function');
  });

});

describe('VIDEO_MAX_REFERENCES', () => {
  it('is defined', () => {
    expect(VIDEO_MAX_REFERENCES).toBeDefined();
  });
});
