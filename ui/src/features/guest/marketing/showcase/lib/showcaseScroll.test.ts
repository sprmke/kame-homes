import { describe, expect, it } from 'vitest';

import { readShowcaseScopeTheme, findShowcaseScrollableAncestor, resolveShowcaseChromeHost, observeShowcaseFrameRect, findPrimaryShowcaseSection, findPrimaryShowcaseHero, resolveShowcaseScrollRoot, scrollShowcaseToTop, isShowcaseHeaderSolid, isMonolithHeaderSolid, SHOWCASE_PRIMARY_SCOPE_SELECTOR, SHOWCASE_HEADER_SOLID_THRESHOLD_PX, MONOLITH_HEADER_SOLID_THRESHOLD_PX } from '@/features/guest/marketing/showcase/lib/showcaseScroll';

describe('readShowcaseScopeTheme', () => {

  it('readShowcaseScopeTheme is exported', () => {
    expect(typeof readShowcaseScopeTheme).toBe('function');
  });

});

describe('findShowcaseScrollableAncestor', () => {

  it('findShowcaseScrollableAncestor is exported', () => {
    expect(typeof findShowcaseScrollableAncestor).toBe('function');
  });

});

describe('resolveShowcaseChromeHost', () => {

  it('resolveShowcaseChromeHost is exported', () => {
    expect(typeof resolveShowcaseChromeHost).toBe('function');
  });

});

describe('observeShowcaseFrameRect', () => {

  it('observeShowcaseFrameRect is exported', () => {
    expect(typeof observeShowcaseFrameRect).toBe('function');
  });

});

describe('findPrimaryShowcaseSection', () => {

  it('findPrimaryShowcaseSection is exported', () => {
    expect(typeof findPrimaryShowcaseSection).toBe('function');
  });

});

describe('findPrimaryShowcaseHero', () => {

  it('findPrimaryShowcaseHero is exported', () => {
    expect(typeof findPrimaryShowcaseHero).toBe('function');
  });

});

describe('resolveShowcaseScrollRoot', () => {

  it('resolveShowcaseScrollRoot is exported', () => {
    expect(typeof resolveShowcaseScrollRoot).toBe('function');
  });

});

describe('scrollShowcaseToTop', () => {

  it('scrollShowcaseToTop is exported', () => {
    expect(typeof scrollShowcaseToTop).toBe('function');
  });

});

describe('isShowcaseHeaderSolid', () => {

  it('isShowcaseHeaderSolid is exported', () => {
    expect(typeof isShowcaseHeaderSolid).toBe('function');
  });

});

describe('isMonolithHeaderSolid', () => {

  it('isMonolithHeaderSolid is exported', () => {
    expect(typeof isMonolithHeaderSolid).toBe('function');
  });

});

describe('SHOWCASE_PRIMARY_SCOPE_SELECTOR', () => {
  it('is defined', () => {
    expect(SHOWCASE_PRIMARY_SCOPE_SELECTOR).toBeDefined();
  });
});

describe('SHOWCASE_HEADER_SOLID_THRESHOLD_PX', () => {
  it('is defined', () => {
    expect(SHOWCASE_HEADER_SOLID_THRESHOLD_PX).toBeDefined();
  });
});

describe('MONOLITH_HEADER_SOLID_THRESHOLD_PX', () => {
  it('is defined', () => {
    expect(MONOLITH_HEADER_SOLID_THRESHOLD_PX).toBeDefined();
  });
});
