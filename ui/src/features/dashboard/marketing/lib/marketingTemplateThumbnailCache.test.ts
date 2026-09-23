import { describe, expect, it } from 'vitest';

import { getCachedMarketingThumbnail, setCachedMarketingThumbnail, subscribeMarketingThumbnailUpdates, publishMarketingPresetThumbnail, marketingBindingCacheKey, designThumbnailKey, designPresetThumbnailKey, videoThumbnailKey, videoPresetThumbnailKey, calendarThumbnailKey, calendarPresetThumbnailKey, calendarSavedStylesThumbnailKey, savedDesignThumbnailKey, savedVideoThumbnailKey } from '@/features/dashboard/marketing/lib/marketingTemplateThumbnailCache';

describe('getCachedMarketingThumbnail', () => {

  it('getCachedMarketingThumbnail is exported', () => {
    expect(typeof getCachedMarketingThumbnail).toBe('function');
  });

});

describe('setCachedMarketingThumbnail', () => {

  it('setCachedMarketingThumbnail is exported', () => {
    expect(typeof setCachedMarketingThumbnail).toBe('function');
  });

});

describe('subscribeMarketingThumbnailUpdates', () => {

  it('subscribeMarketingThumbnailUpdates is exported', () => {
    expect(typeof subscribeMarketingThumbnailUpdates).toBe('function');
  });

});

describe('publishMarketingPresetThumbnail', () => {

  it('publishMarketingPresetThumbnail is exported', () => {
    expect(typeof publishMarketingPresetThumbnail).toBe('function');
  });

});

describe('marketingBindingCacheKey', () => {

  it('marketingBindingCacheKey is exported', () => {
    expect(typeof marketingBindingCacheKey).toBe('function');
  });

});

describe('designThumbnailKey', () => {

  it('designThumbnailKey is exported', () => {
    expect(typeof designThumbnailKey).toBe('function');
  });

});

describe('designPresetThumbnailKey', () => {

  it('designPresetThumbnailKey is exported', () => {
    expect(typeof designPresetThumbnailKey).toBe('function');
  });

});

describe('videoThumbnailKey', () => {

  it('videoThumbnailKey is exported', () => {
    expect(typeof videoThumbnailKey).toBe('function');
  });

});

describe('videoPresetThumbnailKey', () => {

  it('videoPresetThumbnailKey is exported', () => {
    expect(typeof videoPresetThumbnailKey).toBe('function');
  });

});

describe('calendarThumbnailKey', () => {

  it('calendarThumbnailKey is exported', () => {
    expect(typeof calendarThumbnailKey).toBe('function');
  });

});

describe('calendarPresetThumbnailKey', () => {

  it('calendarPresetThumbnailKey is exported', () => {
    expect(typeof calendarPresetThumbnailKey).toBe('function');
  });

});

describe('calendarSavedStylesThumbnailKey', () => {

  it('calendarSavedStylesThumbnailKey is exported', () => {
    expect(typeof calendarSavedStylesThumbnailKey).toBe('function');
  });

});

describe('savedDesignThumbnailKey', () => {

  it('savedDesignThumbnailKey is exported', () => {
    expect(typeof savedDesignThumbnailKey).toBe('function');
  });

});

describe('savedVideoThumbnailKey', () => {

  it('savedVideoThumbnailKey is exported', () => {
    expect(typeof savedVideoThumbnailKey).toBe('function');
  });

});
