import { describe, expect, it } from 'vitest';

import { getShowcaseThemeTokens, showcaseThemeStorageKey } from '@/features/guest/marketing/showcase/lib/showcaseThemeTokens';

describe('getShowcaseThemeTokens', () => {

  it('getShowcaseThemeTokens is exported', () => {
    expect(typeof getShowcaseThemeTokens).toBe('function');
  });

});

describe('showcaseThemeStorageKey', () => {

  it('showcaseThemeStorageKey is exported', () => {
    expect(typeof showcaseThemeStorageKey).toBe('function');
  });

});
