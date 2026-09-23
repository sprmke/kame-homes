import { describe, expect, it } from 'vitest';

import { isSocialPlatform, parseSocialPlatform, SOCIAL_PLATFORMS } from '@/features/dashboard/org/lib/socialPlatformTypes';

describe('isSocialPlatform', () => {

  it('isSocialPlatform is exported', () => {
    expect(typeof isSocialPlatform).toBe('function');
  });

});

describe('parseSocialPlatform', () => {

  it('parseSocialPlatform is exported', () => {
    expect(typeof parseSocialPlatform).toBe('function');
  });

});

describe('SOCIAL_PLATFORMS', () => {
  it('is defined', () => {
    expect(SOCIAL_PLATFORMS).toBeDefined();
  });
});
