import { describe, expect, it } from 'vitest';

import { showcaseScaledRem, showcaseScaledVw, showcaseScaledClampExpr, showcaseScaledClampClass, SHOWCASE_DISPLAY_SCALE_VAR, SHOWCASE_BODY_SCALE_VAR, showcaseSectionHeadingClass, showcaseSectionHeadingLgClass, showcaseEditorialSectionHeadingClass, showcaseBodyTextClass } from '@/features/guest/marketing/showcase/lib/showcaseTypographyScale';

describe('showcaseScaledRem', () => {

  it('showcaseScaledRem is exported', () => {
    expect(typeof showcaseScaledRem).toBe('function');
  });

});

describe('showcaseScaledVw', () => {

  it('showcaseScaledVw is exported', () => {
    expect(typeof showcaseScaledVw).toBe('function');
  });

});

describe('showcaseScaledClampExpr', () => {

  it('showcaseScaledClampExpr is exported', () => {
    expect(typeof showcaseScaledClampExpr).toBe('function');
  });

});

describe('showcaseScaledClampClass', () => {

  it('showcaseScaledClampClass is exported', () => {
    expect(typeof showcaseScaledClampClass).toBe('function');
  });

});

describe('SHOWCASE_DISPLAY_SCALE_VAR', () => {
  it('is defined', () => {
    expect(SHOWCASE_DISPLAY_SCALE_VAR).toBeDefined();
  });
});

describe('SHOWCASE_BODY_SCALE_VAR', () => {
  it('is defined', () => {
    expect(SHOWCASE_BODY_SCALE_VAR).toBeDefined();
  });
});

describe('showcaseSectionHeadingClass', () => {
  it('is defined', () => {
    expect(showcaseSectionHeadingClass).toBeDefined();
  });
});

describe('showcaseSectionHeadingLgClass', () => {
  it('is defined', () => {
    expect(showcaseSectionHeadingLgClass).toBeDefined();
  });
});

describe('showcaseEditorialSectionHeadingClass', () => {
  it('is defined', () => {
    expect(showcaseEditorialSectionHeadingClass).toBeDefined();
  });
});

describe('showcaseBodyTextClass', () => {
  it('is defined', () => {
    expect(showcaseBodyTextClass).toBeDefined();
  });
});
