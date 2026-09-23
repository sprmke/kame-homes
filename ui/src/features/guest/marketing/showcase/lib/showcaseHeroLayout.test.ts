import { describe, expect, it } from 'vitest';

import { showcaseHeroSectionClass, showcaseHeroContentTopClass, showcaseHeroTopAlignedSectionClass, SHOWCASE_HEADER_CHROME_PX, SHOWCASE_HAVEN_HEADER_FLOAT_PX, SHOWCASE_HERO_CONTAINED_CLASS, SHOWCASE_HERO_LIVE_CLASS, SHOWCASE_HERO_CONTENT_TOP_CONTAINED, SHOWCASE_HERO_CONTENT_TOP_LIVE, SHOWCASE_HERO_HAVEN_EXTRA_TOP_LIVE, SHOWCASE_HERO_HAVEN_EXTRA_TOP_CONTAINED } from '@/features/guest/marketing/showcase/lib/showcaseHeroLayout';

describe('showcaseHeroSectionClass', () => {

  it('showcaseHeroSectionClass is exported', () => {
    expect(typeof showcaseHeroSectionClass).toBe('function');
  });

});

describe('showcaseHeroContentTopClass', () => {

  it('showcaseHeroContentTopClass is exported', () => {
    expect(typeof showcaseHeroContentTopClass).toBe('function');
  });

});

describe('showcaseHeroTopAlignedSectionClass', () => {

  it('showcaseHeroTopAlignedSectionClass is exported', () => {
    expect(typeof showcaseHeroTopAlignedSectionClass).toBe('function');
  });

});

describe('SHOWCASE_HEADER_CHROME_PX', () => {
  it('is defined', () => {
    expect(SHOWCASE_HEADER_CHROME_PX).toBeDefined();
  });
});

describe('SHOWCASE_HAVEN_HEADER_FLOAT_PX', () => {
  it('is defined', () => {
    expect(SHOWCASE_HAVEN_HEADER_FLOAT_PX).toBeDefined();
  });
});

describe('SHOWCASE_HERO_CONTAINED_CLASS', () => {
  it('is defined', () => {
    expect(SHOWCASE_HERO_CONTAINED_CLASS).toBeDefined();
  });
});

describe('SHOWCASE_HERO_LIVE_CLASS', () => {
  it('is defined', () => {
    expect(SHOWCASE_HERO_LIVE_CLASS).toBeDefined();
  });
});

describe('SHOWCASE_HERO_CONTENT_TOP_CONTAINED', () => {
  it('is defined', () => {
    expect(SHOWCASE_HERO_CONTENT_TOP_CONTAINED).toBeDefined();
  });
});

describe('SHOWCASE_HERO_CONTENT_TOP_LIVE', () => {
  it('is defined', () => {
    expect(SHOWCASE_HERO_CONTENT_TOP_LIVE).toBeDefined();
  });
});

describe('SHOWCASE_HERO_HAVEN_EXTRA_TOP_LIVE', () => {
  it('is defined', () => {
    expect(SHOWCASE_HERO_HAVEN_EXTRA_TOP_LIVE).toBeDefined();
  });
});

describe('SHOWCASE_HERO_HAVEN_EXTRA_TOP_CONTAINED', () => {
  it('is defined', () => {
    expect(SHOWCASE_HERO_HAVEN_EXTRA_TOP_CONTAINED).toBeDefined();
  });
});
